import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import AICache from "@/models/AICache";
import dbConnect from "@/lib/db";

// Using Llama 3.1 8B Instant (Best balance of speed/cost/quality)
const MODEL_NAME = "llama-3.1-8b-instant";

async function getCachedData(key: string) {
    try {
        await dbConnect();
        const cache = await AICache.findOne({ key });
        if (cache) {
            console.log(`[AICache] Hit for ${key}`);
            return cache.data;
        }
    } catch (error) {
        console.error(`[AICache] Error reading key ${key}:`, error);
    }
    return null;
}

async function setCachedData(key: string, data: any) {
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
        console.error(`[AICache] Error saving key ${key}:`, error);
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
    const cacheKey = `ai_mood_recs_v4_${mood.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

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
        const response = await model.invoke(input);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const sorted = parsed.recommendations
            .map(rec => ({ ...rec, type: normalizeMediaType(rec.type), relevance_score: normalizeScore(rec.relevance_score) }))
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 10);

        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error) {
        console.error("AI Recommendation Error (Groq):", error);
        return [];
    }
}

export async function getMovieInsights(id: number | string, title: string, ratings: any, reviews: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const cacheKey = `movie_insights_v3_${id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

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
        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5).map((r: any) => r.content.substring(0, 200)).join(" | ");

        const prompt = new PromptTemplate({
            template: `Analyze "{title}".
            Ratings: {ratingsSummary}
            Reviews: {reviewsSummary}

            Act as a witty friend. Provide verdict, reason, audience, feeling, ending, consensus.
            
            {format_instructions}`,
            inputVariables: ["title", "ratingsSummary", "reviewsSummary"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ title, ratingsSummary, reviewsSummary });
        const response = await model.invoke(input);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        await setCachedData(cacheKey, parsed);
        return parsed;
    } catch (error) {
        console.error("AI Verdict Error (Groq):", error);
        return null;
    }
}

// Deprecated alias
export const getMovieVerdict = getMovieInsights;

export async function getShowRecommendations(showTitle: string, overview: string, genres: string[]) {
    return await getSimilarContent(showTitle, overview, genres);
}

export async function getSimilarContent(title: string, overview: string, genres: string[], type: 'movie' | 'tv' = 'tv') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    const cacheKey = `ai_similar_v2_${type}_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

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
        template: `Deep dive: {type} "{title}".
        Overview: {overview}
        Genres: {genres}

        Suggest 10 similar items.
        Match VIBE/TONE.
        
        CRITICAL: NO "{title}".
        Score 85-100.
        
        {format_instructions}`,
        inputVariables: ["type", "title", "overview", "genres"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    try {
        const input = await prompt.format({ type, title, overview, genres: genres.join(", ") });
        const response = await model.invoke(input);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);


        const sorted = parsed.recommendations
            .filter(r => r.title.toLowerCase() !== title.toLowerCase())
            .map(rec => ({ ...rec, type: normalizeMediaType(rec.type), relevance_score: normalizeScore(rec.relevance_score) }))
            .sort((a, b) => b.relevance_score - a.relevance_score);

        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error) {
        console.error("AI Similar Content Error (Groq):", error);
        return [];
    }
}

export async function getSeasonRanking(showTitle: string, seasons: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const cacheKey = `tv_ranking_v2_${showTitle.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

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
        const seasonsInfo = seasons.map(s => `Season ${s.season_number}: ${s.name} - ${s.overview}`).join("\n");

        const prompt = new PromptTemplate({
            template: `Rank seasons of "{showTitle}" best to worst.
            
            Seasons:
            {seasonsInfo}
            
            {format_instructions}`,
            inputVariables: ["showTitle", "seasonsInfo"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ showTitle, seasonsInfo });
        const response = await model.invoke(input);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const sorted = parsed.rankings.sort((a, b) => a.rank - b.rank);
        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error) {
        console.error("AI Season Ranking Error (Groq):", error);
        return null;
    }
}
