import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import AICache from "@/models/AICache";
import dbConnect from "@/lib/db";
import { movieService, tvService, TMDB_IMAGE_URL } from "@/lib/tmdb";

// Using Llama 3.1 8B Instant (Best balance of speed/cost/quality)
const MODEL_NAME = "llama-3.1-8b-instant";
const MAX_RPM = 30; // Groq Limit

// In-memory rate limiter (simple counter resets every minute)
const rateLimiter = {
    count: 0,
    resetTime: Date.now() + 60000,
    checkLimit: function () {
        const now = Date.now();
        if (now > this.resetTime) {
            this.count = 0;
            this.resetTime = now + 60000;
        }
        if (this.count >= MAX_RPM) {
            return false;
        }
        this.count++;
        return true;
    }
};

// Helper: Timeout wrapper for AI calls
const callWithTimeout = async (promise: Promise<any>, ms: number) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

async function getCachedData(key: string) {
    try {
        await dbConnect();
        const cache = await AICache.findOne({ key });
        if (cache) {
            console.log(`[AICache] Hit for ${key}`);
            return cache.data;
        }
    } catch (error) {
        console.log(`[AICache] Error reading key ${key}:`, error);
    }
    return null;
}

async function setCachedData(key: string, data: any) {
    // CRITICAL: NEVER cache fallback results. This ensures we retry AI when available.
    // Check if data is array (recs/similar) or object (insights)
    const isFallback = Array.isArray(data)
        ? data.length > 0 && data[0].aiMeta?.source === 'fallback'
        : data?.aiMeta?.source === 'fallback';

    if (isFallback) {
        console.log(`[AICache] Skipping cache for fallback content: ${key}`);
        return;
    }

    try {
        await dbConnect();
        await AICache.findOneAndUpdate(
            { key },
            {
                key,
                data,
                modelUsed: MODEL_NAME
            },
            { upsert: true, new: true }
        );
        console.log(`[AICache] Saved ${key}`);
    } catch (error) {
        console.log(`[AICache] Error saving key ${key}:`, error);
    }
}

function normalizeMediaType(type: string): "movie" | "tv" {
    const t = type.toLowerCase().trim();
    if (t === "movie" || t === "film") return "movie";
    return "tv"; // Default to TV for "anime", "series", "show", etc.
}

function normalizeScore(score: number): number {
    // If score is tiny (e.g. 0.85), assume 0-1 scale -> 85
    if (score <= 1) return Math.round(score * 100);
    // If score is small (e.g. 9.5), assume 0-10 scale -> 95
    if (score <= 10) return Math.round(score * 10);
    // Cap at 100 and round
    if (score > 100) return 100;
    return Math.round(score);
}

/**
 * Helper to clean AI output and extract JSON
 * Llama-3.1-8b-instant often chats or includes markdown code blocks.
 */
function cleanLLMOutput(text: string): string {
    // 1. Remove markdown code blocks like ```json ... ```
    let clean = text.replace(/```json/g, "").replace(/```/g, "");

    // 2. Find all top-level JSON blocks using brace counting
    const blocks: string[] = [];
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < clean.length; i++) {
        if (clean[i] === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (clean[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                blocks.push(clean.substring(startIndex, i + 1));
                startIndex = -1;
            }
        }
    }

    // 3. Select the best block
    // Filter out blocks that look like schemas (contain "$schema" or "type": "object" at root)
    const validBlocks = blocks.filter(b => !b.includes('"$schema"') && !b.includes('"type": "object"'));

    if (validBlocks.length > 0) {
        // Return the last valid block (usually the answer after reasoning/schema)
        return validBlocks[validBlocks.length - 1];
    }

    // Fallback: If no "valid" blocks found (maybe schema check was too aggressive), return the last block found
    if (blocks.length > 0) {
        return blocks[blocks.length - 1];
    }

    // 4. Attempt to fix common JSON errors (missing commas)
    // Regex looks for: end of value (quote, digit, bool) -> newline -> start of key
    const fixed = clean.replace(/(["\d]|true|false|null)\s*\n\s*("[a-zA-Z0-9_]+":)/g, '$1,\n$2');

    // Re-check block logic with fixed string if needed, but usually applying to the extracted block is best.
    // Let's apply it to the chosen block.

    let bestBlock = clean;
    if (validBlocks.length > 0) {
        bestBlock = validBlocks[validBlocks.length - 1];
    } else if (blocks.length > 0) {
        bestBlock = blocks[blocks.length - 1];
    }

    // Apply fix to the best block
    return bestBlock.replace(/(["\d]|true|false|null)\s*\n\s*("[a-zA-Z0-9_]+":)/g, '$1,\n$2');
}

export async function getRecommendationsFromMood(mood: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    // 1. Caching (Bumped to v4 to invalidate old non-normalized scores)
    const cacheKey = `ai_mood_recs_v5_${mood.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    // 2. Check Rate Limit
    if (!rateLimiter.checkLimit()) {
        console.warn(`[Groq] Rate limit exceeded. Using fallback for mood: ${mood}`);
        return await getMoodFallback(mood);
    }

    const model = new ChatGroq({
        apiKey,
        model: MODEL_NAME,
        temperature: 0.7,
    });

    const recommendationSchema = z.object({
        recommendations: z.array(z.object({

            title: z.string(),
            type: z.string(), // Relaxed from enum to prevent crashes
            reason: z.string().describe("Brief reason"),
            relevance_score: z.number().describe("Score (0-100)"),
            target_audience: z.string().describe("Audience"),
            why_watch: z.string().describe("Why watch"),
            ending_mood: z.string().describe("Ending vibe"),
            emotional_impact: z.string().describe("Feeling"),
            critics_consensus: z.string().describe("Brief consensus summary")
        })).min(1).max(10)
    });

    const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

    const prompt = new PromptTemplate({
        template: `Suggest 10 movies/TV shows for mood: "{mood}".
        
        CRITICAL:
        1. Specific, not generic.
        2. Vibe match.
        3. Mix global/formats.
        4. Sort by relevance.
        5. Score between 0 and 100.
        6. VALID JSON ONLY (Check commas!).
        
        Return the results in the following JSON format:
        {format_instructions}`,
        inputVariables: ["mood"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    try {
        const input = await prompt.format({ mood });
        // 10s Timeout limit
        const response = await callWithTimeout(model.invoke(input), 10000);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const sorted = parsed.recommendations
            .map(rec => ({ ...rec, type: normalizeMediaType(rec.type), relevance_score: normalizeScore(rec.relevance_score), aiMeta: { source: 'ai' } }))
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 10);

        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error: any) {
        console.log("AI Recommendation Error (Groq):", error);
        // Fallback on any error to ensure results
        return await getMoodFallback(mood);
    }
}

async function getMoodFallback(mood: string) {
    // Simple fallback: Search TMDB for the mood keyword
    try {
        // 1. Clean the query to be more TMDB-friendly
        // Remove common words that aren't part of titles
        const stopWords = [
            "movies", "movie", "tv", "show", "series", "watch", "looking", "for", "recommendation",
            "films", "film", "about", "with"
        ];
        let cleanQuery = mood.toLowerCase();

        stopWords.forEach(word => {
            cleanQuery = cleanQuery.replace(new RegExp(`\\b${word}\\b`, "g"), "");
        });

        cleanQuery = cleanQuery.trim().replace(/\s+/g, " ");

        // If cleaning removed everything (e.g. "good movies"), revert to original but trimmed
        if (!cleanQuery) cleanQuery = mood;

        console.log(`[Fallback] Searching TMDB for cleaned query: "${cleanQuery}" (Original: "${mood}")`);

        const results = await movieService.searchMulti(cleanQuery);
        let combined = [...results.movies, ...results.tv].slice(0, 10);

        // EXTRA FALLBACK 2: If CLEANED Title Search fails, try KEYWORD DISCOVERY
        // This handles "good vibe" -> ID: "feel good" -> Discover movies
        if (combined.length === 0) {
            console.log(`[Fallback] Title search 0 results. Trying Keyword Discovery for: "${cleanQuery}"`);

            // 1. Search for matching keywords (Try exact phrase first)
            let keywords = await movieService.searchKeywords(cleanQuery);

            // 2. If exact phrase fails, try individual words
            if (keywords.length === 0) {
                const words = cleanQuery.split(/\s+/).filter(w => w.length > 2); // Split by space, ignore short words
                if (words.length > 1) {
                    console.log(`[Fallback] Exact keyword failed. Searching words: ${words.join(", ")}`);
                    const wordResults = await Promise.all(words.map(w => movieService.searchKeywords(w)));
                    // Flatten and deduplicate
                    const allKeywords = wordResults.flat();
                    // Use a Map to deduplicate by ID while keeping objects
                    const uniqueKeywords = new Map();
                    allKeywords.forEach(k => uniqueKeywords.set(k.id, k));
                    keywords = Array.from(uniqueKeywords.values());
                }
            }

            if (keywords.length > 0) {
                // Use top 5 keywords (increased/OR logic)
                const keywordIds = keywords.slice(0, 5).map(k => k.id).join("|"); // OR logic
                console.log(`[Fallback] Found keywords: ${keywords.slice(0, 5).map(k => k.name).join(", ")} (IDs: ${keywordIds})`);

                const discovery = await movieService.getDiscover({
                    with_keywords: keywordIds,
                    sort_by: "popularity.desc"
                });

                if (discovery.results.length > 0) {
                    combined = discovery.results.slice(0, 10).map(m => ({ ...m, media_type: 'movie' }));
                }
            } else {
                console.log(`[Fallback] No keywords found.`);
            }
        }

        // EXTRA FALLBACK 3: If still nothing, try RAW query search (in case cleaning removed key parts or if it's a very specific title)
        if (combined.length === 0 && cleanQuery !== mood.toLowerCase()) {
            console.log(`[Fallback] Trying raw query: "${mood}"`);
            const rawResults = await movieService.searchMulti(mood);
            combined = [...rawResults.movies, ...rawResults.tv].slice(0, 10);
        }

        return combined.map(item => ({
            ...item,
            title: (item as any).title || (item as any).name, // Handle both Movie (title) and TV (name)
            media_type: item.media_type || 'movie',
            type: item.media_type || 'movie', // Explicitly set type to match AI structure
            relevance_score: 85, // Generic score for fallback
            aiMeta: {
                source: 'fallback',
                relevance_score: 80,
                // Return empty strings so the UI can replace them with a "Semantic Result" badge
                reason: "",
                why_watch: "",
                target_audience: "",
                emotional_impact: "",
                ending_mood: "",
                critics_consensus: ""
            }
        }));
    } catch (e) {
        console.log("Fallback error", e);
        return [];
    }
}

export async function getMovieInsights(id: number | string, title: string, ratings: any, reviews: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const cacheKey = `movie_insights_v4_${id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    // 2. Check Rate Limit
    if (!rateLimiter.checkLimit()) {
        // Fallback for insights is just static data as we can't easily generate new text without AI
        return getInsightFallback();
    }

    const model = new ChatGroq({
        apiKey,
        model: MODEL_NAME,
        temperature: 0.7,
    });

    const insightsSchema = z.object({
        verdict: z.string(),
        reason: z.string(),
        for_whom: z.string().describe("Audience"),
        feeling: z.string().describe("Emotion"),
        ending_vibe: z.string(),
        critics_consensus: z.string().describe("Brief summary")
    });

    const parser = StructuredOutputParser.fromZodSchema(insightsSchema);

    try {
        if (!Array.isArray(reviews)) {
            console.log("AI Verdict: Reviews is not an array, defaulting to empty.");
            reviews = [];
        }

        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5)
            .map((r: any) => (r?.content ? r.content.substring(0, 200) : ""))
            .join(" | ");

        const prompt = new PromptTemplate({
            template: `Analyze "{title}".
            Ratings: {ratingsSummary}
            Reviews: {reviewsSummary}

            Act as a witty friend. Provide verdict, reason, audience, feeling, ending, consensus.
            
            {format_instructions}`,
            inputVariables: ["title", "ratingsSummary", "reviewsSummary"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ title: title || "Unknown Title", ratingsSummary, reviewsSummary });
        // 20s Timeout limit (User Requested)
        const response = await callWithTimeout(model.invoke(input), 20000);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const result = { ...parsed, aiMeta: { source: 'ai' } };

        await setCachedData(cacheKey, result);
        return result;
    } catch (error: any) {
        // Log only message to avoid "source map" parsing errors with complex objects
        console.log(`AI Verdict Error (Groq): ${error?.message || String(error)}`);
        // Fallback on any error
        return getInsightFallback();
    }
}

function getInsightFallback() {
    return {
        verdict: "AI verdict is not available - will show after a while",
        reason: "The AI is currently experiencing high traffic or is taking longer than expected. Please check back later.",
        for_whom: "Fans of the genre",
        feeling: "Unknown",
        ending_vibe: "Unknown",
        critics_consensus: "Detailed AI analysis unavailable momentarily.",
        aiMeta: { source: 'fallback' }
    };
}

// Deprecated alias
export const getMovieVerdict = getMovieInsights;

export async function getShowRecommendations(showTitle: string, overview: string, genres: string[]) {
    return await getSimilarContent(showTitle, overview, genres);
}

// Updated to accept optional tmdbId for fallback
export async function getSimilarContent(title: string, overview: string, genres: string[], type: 'movie' | 'tv' = 'tv', tmdbId?: number) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    const cacheKey = `ai_similar_v3_${type}_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    // Rate Limit Check
    if (!rateLimiter.checkLimit()) {
        console.warn(`[Groq] Rate limit exceeded. Using fallback for similar content: ${title}`);
        return await getSimilarFallback(title, type, tmdbId, genres);
    }

    const model = new ChatGroq({
        apiKey,
        model: MODEL_NAME,
        temperature: 0.7,
    });

    const recommendationSchema = z.object({
        recommendations: z.array(z.object({
            title: z.string(),
            type: z.string(), // Relaxed from enum
            reason: z.string(),
            target_audience: z.string(),
            why_watch: z.string(),
            ending_mood: z.string(),
            emotional_impact: z.string(),
            critics_consensus: z.string(),
            relevance_score: z.number().describe("Match % (0-100)")
        }))
    });

    const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

    const prompt = new PromptTemplate({
        template: `Recs: {type} "{title}".
        Overview: {overview}
        Genres: {genres}

        10 items. Match Vibe. NO "{title}".
        Score 85-100.
        JSON only.
        
        {format_instructions}`,
        inputVariables: ["type", "title", "overview", "genres"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    try {
        const input = await prompt.format({ type, title, overview, genres: genres.slice(0, 3).join(", ") }); // Limit genres to reduce tokens

        // 10s Timeout limit
        const response = await callWithTimeout(model.invoke(input), 10000);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);


        const sorted = parsed.recommendations
            .filter(r => r.title.toLowerCase() !== title.toLowerCase())
            .map(rec => ({
                ...rec,
                type: normalizeMediaType(rec.type),
                relevance_score: normalizeScore(rec.relevance_score),
                aiMeta: { source: 'ai' }
            }))
            .sort((a, b) => b.relevance_score - a.relevance_score);

        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error: any) {
        console.log("AI Similar Content Error (Groq):", error);
        // Fallback on any error
        return await getSimilarFallback(title, type, tmdbId, genres);
    }
}

async function getSimilarFallback(title: string, type: 'movie' | 'tv', tmdbId?: number, genres: string[] = []) {
    try {
        let results: any[] = [];

        // 1. Try TMDB Similar endpoint if ID is available
        if (tmdbId) {
            if (type === 'movie') {
                results = await movieService.getSimilar(tmdbId);
            } else {
                results = await tvService.getSimilar(tmdbId);
            }
        }

        // 2. If no ID or no results, try Search/Discover
        if (!results || results.length === 0) {
            // Fallback to searching the title to get an ID if we don't have one, effectively "similar to name"
            // But simpler is just to search for title assuming it might return related things or discover by genre
            // Let's stick to Discover by Genre if available as it's better for "Similar" than searching the name
            if (genres && genres.length > 0) {
                // We will need genre map mapping, but we have strings.
                // For now, let's just use Search Multi with the title which might find the item + sequels/remakes
                // Actually, simpler: Search for the title + "similar" is not a valid query.
                // Let's just fallback to Trending/Popular if all else fails or verify simple search
                const searchRes = await movieService.searchMulti(title);
                // Filter out the item itself
                results = [...searchRes.movies, ...searchRes.tv].filter(i => (i as any).title !== title && (i as any).name !== title);
            }
        }

        return results.slice(0, 10).map(item => ({
            ...item,
            title: (item as any).title || (item as any).name, // Handle both Movie (title) and TV (name)
            media_type: item.media_type || type,
            relevance_score: 80 + Math.floor(Math.random() * 10), // Random 80-90 score
            aiMeta: {
                source: 'fallback',
                relevance_score: 80,
                // Return empty strings so the UI can replace them with a "Semantic Result" badge
                reason: "",
                why_watch: "",
                target_audience: "",
                emotional_impact: "",
                ending_mood: "",
                critics_consensus: ""
            }
        }));

    } catch (e) {
        console.log("Fallback error", e);
        return [];
    }
}


export async function getSeasonRanking(showTitle: string, seasons: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const cacheKey = `tv_ranking_v3_${showTitle.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    // Rate Limit Check
    if (!rateLimiter.checkLimit()) {
        return getSeasonRankingFallback(seasons);
    }

    const model = new ChatGroq({
        apiKey,
        model: MODEL_NAME,
        temperature: 0.3,
    });

    const rankingSchema = z.object({
        rankings: z.array(z.object({
            season_number: z.number(),
            rank: z.number(),
            score: z.number(),
            verdict: z.string(),
            reason: z.string(),
            audience_reception: z.string(),
            critics_consensus: z.string()
        }))
    });

    const parser = StructuredOutputParser.fromZodSchema(rankingSchema);

    try {
        if (!Array.isArray(seasons)) {
            console.log("AI Ranking: Seasons is not an array, defaulting to empty.");
            seasons = [];
        }

        const seasonsInfo = seasons.map(s => `Season ${s.season_number}: ${s.name} - ${s.overview}`).join("\n");

        const prompt = new PromptTemplate({
            template: `Rank seasons of "{showTitle}" best to worst.
            
            Seasons:
            {seasonsInfo}
            
            {format_instructions}`,
            inputVariables: ["showTitle", "seasonsInfo"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ showTitle: showTitle || "Unknown Show", seasonsInfo });
        const response = await callWithTimeout(model.invoke(input), 10000);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const sorted = parsed.rankings.sort((a, b) => a.rank - b.rank).map(r => ({ ...r, aiMeta: { source: 'ai' } }));
        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error: any) {
        // Safe logging to avoid source map errors
        console.log(`AI Season Ranking Error (Groq): ${error?.message || String(error)}`);
        // Fallback on any error
        return getSeasonRankingFallback(seasons);
    }
}

function getSeasonRankingFallback(seasons: any[]) {
    // Sort by simple logic: Season number (Latest first or first first?) usually people like early seasons?
    // Or effectively just return them in order.
    // Better: Sort by vote_average if available, otherwise index
    const sorted = [...seasons].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

    return sorted.map((s, i) => ({
        season_number: s.season_number,
        rank: i + 1,
        score: s.vote_average ? s.vote_average * 10 : 80,
        verdict: s.vote_average > 8 ? "Excellent" : "Good",
        reason: "Ranked based on user ratings (Fallback)",
        audience_reception: "Generally liked",
        critics_consensus: "Ratings based ranking.",
        aiMeta: { source: 'fallback' }
    }));
}
