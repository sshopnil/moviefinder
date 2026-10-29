import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText, streamObject } from "ai";
import { createHash } from "node:crypto";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import AICache from "../models/AICache.ts";
import dbConnect from "./db.ts";
import { movieService, tvService, TMDB_IMAGE_URL } from "./tmdb.ts";
import type { Movie, TVSeries, AIRecommendation } from "../types/movie.ts";
import { normalizeScore } from "./utils.ts";
import { getGenreName } from "./genres.ts";
export { normalizeScore };

const AI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export function getMaxRpm(): number {
    const val = process.env.GEMINI_MAX_RPM;
    return val ? parseInt(val, 10) || 15 : 15;
}

const AI_CACHE_DB_TIMEOUT_MS = Number(process.env.AI_CACHE_DB_TIMEOUT_MS) || 5000;

export const STOP_WORDS_REGEX = /\b(movies?|tv|shows?|series|watch|looking|for|recommendations?|films?|about|with)\b/gi;

const moodRecommendationSchema = z.object({
    title: z.string().trim().min(1),
    type: z.string().trim().min(1),
    reason: z.string().trim().min(10).describe("Brief reason"),
    relevance_score: z.number().describe("Score (0-100)"),
    target_audience: z.string().trim().min(3).describe("Audience"),
    why_watch: z.string().trim().min(10).describe("Why watch"),
    ending_mood: z.string().trim().min(3).describe("Ending vibe"),
    emotional_impact: z.string().trim().min(3).describe("Feeling"),
    critics_consensus: z.string().trim().min(10).describe("Brief consensus summary"),
});

const seasonRankingSchema = z.object({
    season_number: z.number(),
    rank: z.number(),
    score: z.number(),
    verdict: z.string(),
    reason: z.string(),
    audience_reception: z.string(),
    critics_consensus: z.string(),
});

export interface AIRateLimitInfo {
    limit: number;
    count: number;
    retryAfterSeconds: number;
    resetAt: number;
}

export class AIRateLimitError extends Error {
    rateLimit: AIRateLimitInfo;

    constructor(rateLimit: AIRateLimitInfo) {
        super(`AI request limit reached. Try again in ${rateLimit.retryAfterSeconds}s.`);
        this.name = "AIRateLimitError";
        this.rateLimit = rateLimit;
    }
}

export function isAIRateLimitError(error: unknown): error is AIRateLimitError {
    return error instanceof AIRateLimitError
        || (
            typeof error === "object"
            && error !== null
            && (error as { name?: string }).name === "AIRateLimitError"
            && "rateLimit" in error
        );
}

interface AIRateLimitState {
    count: number;
    resetAt: number;
}

const globalForAIRateLimit = globalThis as typeof globalThis & {
    __movieFinderAIRateLimit?: AIRateLimitState;
};

const aiRateLimit = globalForAIRateLimit.__movieFinderAIRateLimit
    ?? (globalForAIRateLimit.__movieFinderAIRateLimit = { count: 0, resetAt: 0 });

export function getAIRateLimitInfo(): AIRateLimitInfo {
    const maxRpm = getMaxRpm();
    const now = Date.now();
    if (!aiRateLimit.resetAt || now >= aiRateLimit.resetAt) {
        aiRateLimit.count = 0;
        aiRateLimit.resetAt = now + 60_000;
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((aiRateLimit.resetAt - now) / 1000));
    return {
        limit: maxRpm,
        count: aiRateLimit.count,
        retryAfterSeconds,
        resetAt: aiRateLimit.resetAt,
    };
}

export function markAIRateLimited(retryAfterSeconds = 60) {
    const maxRpm = getMaxRpm();
    const now = Date.now();
    aiRateLimit.resetAt = now + Math.max(10, retryAfterSeconds) * 1000;
    aiRateLimit.count = maxRpm;
}

export function isQuotaError(error: unknown): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status || (error as any)?.statusCode || (error as any)?.response?.status;
    return status === 429 || /quota|resource_exhausted|rate limit|429/i.test(msg);
}

function getAIKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

function consumeAIRateLimit() {
    const maxRpm = getMaxRpm();
    const now = Date.now();

    if (!aiRateLimit.resetAt || now >= aiRateLimit.resetAt) {
        aiRateLimit.count = 0;
        aiRateLimit.resetAt = now + 60_000;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((aiRateLimit.resetAt - now) / 1000));

    if (aiRateLimit.count >= maxRpm) {
        throw new AIRateLimitError({
            limit: maxRpm,
            count: aiRateLimit.count,
            retryAfterSeconds,
            resetAt: aiRateLimit.resetAt,
        });
    }

    aiRateLimit.count++;
}


const withCacheTimeout = async (promise: Promise<any>, ms: number) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`AI cache DB timeout after ${ms}ms`)), ms);
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

async function invokeAI(apiKey: string, input: string, temperature: number = 0.7) {
    const google = createGoogleGenerativeAI({ apiKey });

    try {
        const response = await generateText({
            model: google(AI_MODEL),
            prompt: input,
            temperature,
        });

        return { content: response.text };
    } catch (error: any) {
        console.log(`[AI] Model ${AI_MODEL} failed: ${error?.message || String(error)}`);
        throw error;
    }
}

async function getCachedData(key: string) {
    try {
        const cache = await withCacheTimeout(
            dbConnect().then(() => AICache.findOne({ key }).lean()),
            AI_CACHE_DB_TIMEOUT_MS
        );
        if (cache && typeof cache === "object" && "data" in cache) {
            const cachedData = (cache as { data: any }).data;
            const isFallback = Array.isArray(cachedData)
                ? cachedData.length === 0 || cachedData.some(item => !item || item.aiMeta?.source === 'fallback' || item.aiMeta?.source === 'rate_limited')
                : !cachedData || cachedData?.aiMeta?.source === 'fallback' || cachedData?.aiMeta?.source === 'rate_limited';

            if (isFallback) {
                console.log(`[AICache] Discarding stale fallback cache for ${key}`);
                void AICache.deleteOne({ key }).catch(() => {});
                return null;
            }

            console.log(`[AICache] Hit for ${key}`);
            return cachedData;
        }
    } catch (error) {
        console.log(`[AICache] Skipping cache read for ${key}:`, error instanceof Error ? error.message : error);
    }
    return null;
}

async function setCachedData(key: string, data: any) {
    // CRITICAL: NEVER cache fallback or semantic results. This ensures we retry AI when available.
    if (!data) return;

    const isFallback = Array.isArray(data)
        ? data.length === 0 || data.some(item => !item || item.aiMeta?.source === 'fallback' || item.aiMeta?.source === 'rate_limited')
        : data?.aiMeta?.source === 'fallback' || data?.aiMeta?.source === 'rate_limited';

    if (isFallback) {
        console.log(`[AICache] Skipping cache for fallback/semantic content: ${key}`);
        return;
    }

    try {
        await withCacheTimeout(
            dbConnect().then(() =>
                AICache.findOneAndUpdate(
                    { key },
                    {
                        key,
                        data,
                        modelUsed: AI_MODEL
                    },
                    { upsert: true, new: true }
                ).lean()
            ),
            AI_CACHE_DB_TIMEOUT_MS
        );
        console.log(`[AICache] Saved ${key}`);
    } catch (error) {
        console.log(`[AICache] Skipping cache save for ${key}:`, error instanceof Error ? error.message : error);
    }
}

function normalizeMediaType(type: string): "movie" | "tv" {
    const t = type.toLowerCase().trim();
    if (t === "movie" || t === "film") return "movie";
    return "tv"; // Default to TV for "anime", "series", "show", etc.
}


/**
 * Helper to clean AI output and extract JSON
 * Llama-3.1-8b-instant often chats or includes markdown code blocks.
 */
export function cleanLLMOutput(text: string): string {
    if (!text) return "";

    // 1. Remove markdown code blocks like ```json ... ```
    const clean = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

    // Fast path: if the whole cleaned string is already valid JSON, return it
    try {
        JSON.parse(clean);
        return clean;
    } catch {
        // Proceed with block extraction
    }

    // 2. Find all top-level JSON blocks ({...} or [...]) with string awareness
    const blocks: string[] = [];
    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let isEscaped = false;
    let openChar: "{" | "[" | null = null;
    let closeChar: "}" | "]" | null = null;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === "\\") {
                isEscaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (depth === 0) {
            if (char === "{" || char === "[") {
                openChar = char;
                closeChar = char === "{" ? "}" : "]";
                depth = 1;
                startIndex = i;
            }
        } else {
            if (char === openChar) {
                depth++;
            } else if (char === closeChar) {
                depth--;
                if (depth === 0 && startIndex !== -1) {
                    blocks.push(clean.substring(startIndex, i + 1));
                    startIndex = -1;
                    openChar = null;
                    closeChar = null;
                }
            }
        }
    }

    // 3. Filter out schema definition blocks (contain "$schema" or "type": "object")
    const candidateBlocks = blocks.filter(b => !b.includes('"$schema"') && !b.includes('"type": "object"'));
    const blocksToTry = candidateBlocks.length > 0 ? candidateBlocks : blocks;

    // Check candidate blocks from last to first (answers usually follow preamble or chain-of-thought)
    for (let i = blocksToTry.length - 1; i >= 0; i--) {
        const candidate = blocksToTry[i];
        try {
            JSON.parse(candidate);
            return candidate;
        } catch {
            const withCommas = candidate.replace(/(["\d]|true|false|null)[ \t]*\n[ \t]*("[a-zA-Z0-9_]+":)/g, "$1,\n$2");
            try {
                JSON.parse(withCommas);
                return withCommas;
            } catch {
                // Keep trying other candidate blocks
            }
        }
    }

    // 4. Fallback if no block cleanly parsed: return the last block found or trimmed string
    if (blocksToTry.length > 0) {
        const lastBlock = blocksToTry[blocksToTry.length - 1];
        return lastBlock.replace(/(["\d]|true|false|null)[ \t]*\n[ \t]*("[a-zA-Z0-9_]+":)/g, "$1,\n$2");
    }

    return clean;
}

export function makeAICacheKey(prefix: string, ...parts: (string | number | undefined | null)[]): string {
    const raw = parts.map(p => (p == null ? "" : String(p).trim().toLowerCase())).join(":");
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
    return `${prefix}_${hash}`;
}

export async function getRecommendationsFromMood(mood: string) {
    const apiKey = getAIKey();
    if (!apiKey) return getMoodFallback(mood);

    // 1. Caching
    const cacheKey = makeAICacheKey("ai_mood_recs_v5", mood);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    consumeAIRateLimit();

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

    try {
        const google = createGoogleGenerativeAI({ apiKey });
        const { object } = await generateObject({
            model: google(AI_MODEL),
            schema: recommendationSchema,
            temperature: 0.7,
            prompt: `Suggest 10 movies/TV shows for mood: "${mood}".
CRITICAL:
1. Specific, not generic.
2. Vibe match.
3. Mix global/formats.
4. Sort by relevance.
5. Score between 0 and 100.`,
        });

        const sorted = object.recommendations
            .map(rec => ({ ...rec, type: normalizeMediaType(rec.type), relevance_score: normalizeScore(rec.relevance_score), aiMeta: { source: 'ai' } }))
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 10);

        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error: any) {
        console.log("AI Recommendation Error:", error);
        if (isQuotaError(error)) {
            markAIRateLimited();
            return await getMoodFallback(mood, 1, undefined, getAIRateLimitInfo());
        }
        return await getMoodFallback(mood);
    }
}

export async function* streamRecommendationsFromMood(
    mood: string,
    options: { page?: number; excludeTitles?: string[]; mediaType?: string; refresh?: boolean; signal?: AbortSignal } = {},
) {
    const page = Math.max(1, options.page || 1);
    const apiKey = getAIKey();
    if (!apiKey) {
        for (const recommendation of await getMoodFallback(mood, page, options.signal)) yield recommendation;
        return;
    }

    const mediaType = options.mediaType === "movie" || options.mediaType === "tv" ? options.mediaType : "movie or TV show";
    const excluded = (options.excludeTitles || []).slice(-30);
    const cacheKey = makeAICacheKey(`ai_mood_recs_v10_${page}_${options.mediaType || 'all'}`, mood);
    if (!options.refresh) {
        const cached = await getCachedData(cacheKey);
        if (cached) {
            for (const recommendation of cached) yield recommendation;
            return;
        }
    }

    try {
        consumeAIRateLimit();
    } catch (error) {
        if (isAIRateLimitError(error)) {
            console.warn(`[AI] Rate limit reached. Serving fallback recommendations for mood: "${mood}"`);
            const fallback = await getMoodFallback(mood, page, options.signal, error.rateLimit);
            for (const recommendation of fallback) {
                yield {
                    ...recommendation,
                    aiMeta: {
                        ...(recommendation as any).aiMeta,
                        source: "rate_limited",
                        rateLimit: error.rateLimit,
                    },
                };
            }
            return;
        }
        throw error;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const generated: unknown[] = [];
    const generatedTitles = new Set(excluded.map(title => title.toLowerCase()));

    const candidateTarget = 8;

    try {
        for (let attempt = 0; attempt < 2 && generated.length === 0; attempt++) {
            if (options.signal?.aborted) break;
            try {
                const requestedCount = candidateTarget - generated.length;
                const abortSignal = options.signal
                    ? AbortSignal.any([AbortSignal.timeout(30_000), options.signal])
                    : AbortSignal.timeout(30_000);

                const result = streamObject({
                    model: google(AI_MODEL),
                    output: "array",
                    schema: moodRecommendationSchema,
                    temperature: 0.7,
                    maxOutputTokens: 4500,
                    abortSignal,
                    prompt: `Generate batch ${page} of recommendations for this mood: "${mood}".
Return exactly ${requestedCount} distinct ${mediaType} recommendations.
Use specific, varied global titles ordered by relevance. Scores must be from 0 to 100.
Every recommendation must be a real, released title that can be found on TMDB. Complete every text field with specific analysis; never return empty strings.
Do not include any of these previously shown or generated titles: ${Array.from(generatedTitles).join(", ") || "none"}.`,
                });

                for await (const recommendation of result.elementStream) {
                    const titleKey = recommendation.title.toLowerCase();
                    if (generatedTitles.has(titleKey)) continue;
                    generatedTitles.add(titleKey);

                    const normalized = {
                        ...recommendation,
                        type: normalizeMediaType(recommendation.type),
                        relevance_score: normalizeScore(recommendation.relevance_score),
                        aiMeta: { source: "ai" },
                    };
                    generated.push(normalized);
                    yield normalized;
                }
            } catch (error) {
                console.log(`AI Recommendation Stream Attempt ${attempt + 1} Error:`, error);
                if (isQuotaError(error)) {
                    markAIRateLimited();
                }
            }
        }

        if (generated.length === 0 && !options.signal?.aborted) {
            const fallback = await getMoodFallback(mood, page, options.signal, getAIRateLimitInfo());
            for (const recommendation of fallback) yield recommendation;
        }
    } finally {
        if (generated.length >= 4 && !generated.some((item: any) => item.aiMeta?.source === 'fallback' || item.aiMeta?.source === 'rate_limited')) {
            await setCachedData(cacheKey, generated);
        }
    }
}

async function getMoodFallback(mood: string, page: number = 1, signal?: AbortSignal, rateLimitInfo?: AIRateLimitInfo) {
    try {
        if (signal?.aborted) return [];

        let cleanQuery = mood.toLowerCase().replace(STOP_WORDS_REGEX, "").trim().replace(/\s+/g, " ");
        if (!cleanQuery) cleanQuery = mood;

        console.log(`[Fallback] Searching TMDB for query: "${cleanQuery}" (Original: "${mood}")`);

        const results = await movieService.searchMulti(cleanQuery, page, signal);
        let combined = [...results.movies, ...results.tv].slice(0, 10);

        if (combined.length === 0 && !signal?.aborted) {
            console.log("[Fallback] No query matches. Using current popular titles.");
            const [popularMovies, popularTV] = await Promise.all([
                movieService.getPopular(signal),
                tvService.getPopular(signal),
            ]);
            combined = [...popularMovies.slice(0, 5), ...popularTV.slice(0, 5)];
        }

        const currentRateLimit = rateLimitInfo || getAIRateLimitInfo();

        return combined.map(item => ({
            ...item,
            title: (item as any).title || (item as any).name,
            media_type: item.media_type || 'movie',
            type: item.media_type || 'movie',
            relevance_score: 85,
            aiMeta: {
                source: 'fallback',
                rateLimit: currentRateLimit,
                relevance_score: 80,
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

export async function getSemanticMoodRecommendations(mood: string, page: number = 1, signal?: AbortSignal) {
    return getMoodFallback(mood, page, signal);
}

export async function getMovieInsights(id: number | string, title: string, ratings: any, reviews: any[]) {
    const apiKey = getAIKey();
    if (!apiKey) return null;

    const cacheKey = makeAICacheKey("movie_insights_v4", id);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        consumeAIRateLimit();
    } catch (error) {
        if (isAIRateLimitError(error)) {
            return getInsightFallback(error.rateLimit);
        }
        throw error;
    }

    const insightsSchema = z.object({
        verdict: z.string(),
        reason: z.string(),
        for_whom: z.string().describe("Audience"),
        feeling: z.string().describe("Emotion"),
        ending_vibe: z.string(),
        critics_consensus: z.string().describe("Brief summary")
    });

    try {
        if (!Array.isArray(reviews)) {
            console.log("AI Verdict: Reviews is not an array, defaulting to empty.");
            reviews = [];
        }

        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5)
            .map((r: any) => (r?.content ? r.content.substring(0, 200) : ""))
            .join(" | ");

        const google = createGoogleGenerativeAI({ apiKey });
        const { object } = await generateObject({
            model: google(AI_MODEL),
            schema: insightsSchema,
            temperature: 0.7,
            prompt: `Analyze "${title}".\nRatings: ${ratingsSummary}\nReviews: ${reviewsSummary}\nAct as a witty friend. Provide verdict, reason, audience fit, feeling, ending vibe, and critics consensus.`,
        });

        const result = { ...object, aiMeta: { source: 'ai' } };

        await setCachedData(cacheKey, result);
        return result;
    } catch (error: any) {
        // Log only message to avoid "source map" parsing errors with complex objects
        console.log(`AI Verdict Error: ${error?.message || String(error)}`);
        if (isQuotaError(error)) {
            markAIRateLimited();
            return getInsightFallback(getAIRateLimitInfo());
        }
        return getInsightFallback();
    }
}

function getInsightFallback(rateLimit?: AIRateLimitInfo) {
    return {
        verdict: "AI verdict is not available - will show after a while",
        reason: rateLimit
            ? `AI request limit reached. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
            : "The AI is currently experiencing high traffic or is taking longer than expected. Please check back later.",
        for_whom: "Fans of the genre",
        feeling: "Unknown",
        ending_vibe: "Unknown",
        critics_consensus: "Detailed AI analysis unavailable momentarily.",
        aiMeta: rateLimit ? { source: 'rate_limited', rateLimit } : { source: 'fallback' }
    };
}

// Deprecated alias
export const getMovieVerdict = getMovieInsights;

export async function getShowRecommendations(showTitle: string, overview: string, genres: string[]) {
    return await getSimilarContent(showTitle, overview, genres);
}

// Updated to accept optional tmdbId for fallback
export async function getSimilarContent(title: string, overview: string, genres: string[], type: 'movie' | 'tv' = 'tv', tmdbId?: number) {
    const apiKey = getAIKey();
    if (!apiKey) return getSimilarFallback(title, type, tmdbId, genres);

    const cacheKey = makeAICacheKey(`ai_similar_v3_${type}`, title);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    consumeAIRateLimit();

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

        const response = await invokeAI(apiKey, input, 0.7);

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
        console.log("AI Similar Content Error:", error);
        // Fallback on any error
        return await getSimilarFallback(title, type, tmdbId, genres);
    }
}

export async function* streamSimilarContent(
    title: string,
    overview: string,
    genres: string[],
    type: 'movie' | 'tv' = 'tv',
    tmdbId?: number,
    signal?: AbortSignal
) {
    const apiKey = getAIKey();
    if (!apiKey) {
        for (const recommendation of await getSimilarFallback(title, type, tmdbId, genres, signal)) yield recommendation;
        return;
    }

    const cacheKey = makeAICacheKey(`ai_similar_v3_${type}`, title);
    const cached = await getCachedData(cacheKey);
    if (cached) {
        for (const recommendation of cached) yield recommendation;
        return;
    }

    try {
        consumeAIRateLimit();
    } catch (error) {
        if (isAIRateLimitError(error)) {
            console.warn(`[AI] Rate limit reached. Serving fallback similar content for "${title}"`);
            const fallback = await getSimilarFallback(title, type, tmdbId, genres, signal);
            for (const recommendation of fallback) {
                yield {
                    ...recommendation,
                    aiMeta: {
                        ...(recommendation as any).aiMeta,
                        source: "rate_limited",
                        rateLimit: error.rateLimit,
                    },
                };
            }
            return;
        }
        throw error;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const generated: unknown[] = [];

    try {
        const abortSignal = signal
            ? AbortSignal.any([AbortSignal.timeout(45_000), signal])
            : AbortSignal.timeout(45_000);

        const result = streamObject({
            model: google(AI_MODEL),
            output: "array",
            schema: moodRecommendationSchema,
            temperature: 0.7,
            maxOutputTokens: 4500,
            abortSignal,
            prompt: `Suggest 8 movies or TV shows similar to this ${type}: "${title}".
Overview: ${overview}
Genres: ${genres.slice(0, 3).join(", ")}
Match its mood, pacing, audience, and ending vibe. Do not include "${title}". Order by relevance with scores from 0 to 100.`,
        });

        for await (const recommendation of result.elementStream) {
            if (recommendation.title.toLowerCase() === title.toLowerCase()) continue;
            const normalized = {
                ...recommendation,
                type: normalizeMediaType(recommendation.type),
                relevance_score: normalizeScore(recommendation.relevance_score),
                aiMeta: { source: "ai" },
            };
            generated.push(normalized);
            yield normalized;
        }
    } catch (error) {
        console.log("AI Similar Content Stream Error:", error);
        if (isQuotaError(error)) {
            markAIRateLimited();
        }
    } finally {
        if (generated.length === 0 && !signal?.aborted) {
            const fallback = await getSimilarFallback(title, type, tmdbId, genres, signal);
            for (const recommendation of fallback) yield recommendation;
        }
        if (generated.length >= 4 && !generated.some((item: any) => item.aiMeta?.source === 'fallback' || item.aiMeta?.source === 'rate_limited')) {
            await setCachedData(cacheKey, generated);
        }
    }
}

async function getSimilarFallback(title: string, type: 'movie' | 'tv', tmdbId?: number, genres: string[] = [], signal?: AbortSignal) {
    try {
        if (signal?.aborted) return [];
        let results: any[] = [];

        // 1. Try TMDB Similar endpoint if ID is available
        if (tmdbId) {
            results = type === 'movie'
                ? await movieService.getSimilar(tmdbId, signal)
                : await tvService.getSimilar(tmdbId, signal);
        }

        // 2. If no ID or no results, try Search
        if ((!results || results.length === 0) && !signal?.aborted) {
            const searchRes = await movieService.searchMulti(title, 1, signal);
            results = [...searchRes.movies, ...searchRes.tv].filter(i => (i as any).title !== title && (i as any).name !== title);
        }

        if ((!results || results.length === 0) && !signal?.aborted) {
            results = type === "movie"
                ? await movieService.getPopular(signal)
                : await tvService.getPopular(signal);
        }

        const currentRateLimit = getAIRateLimitInfo();

        return results.slice(0, 10).map(item => ({
            ...item,
            title: (item as any).title || (item as any).name,
            media_type: item.media_type || type,
            relevance_score: 80 + Math.floor(Math.random() * 10),
            aiMeta: {
                source: 'fallback',
                rateLimit: currentRateLimit,
                relevance_score: 80,
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
    const apiKey = getAIKey();
    if (!apiKey) return null;

    const cacheKey = makeAICacheKey("tv_ranking_v3", showTitle);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        consumeAIRateLimit();
    } catch (error) {
        if (isAIRateLimitError(error)) {
            return getSeasonRankingFallback(seasons, error.rateLimit);
        }
        throw error;
    }

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
        const response = await invokeAI(apiKey, input, 0.3);

        const cleaned = cleanLLMOutput(response.content as string);
        const parsed = await parser.parse(cleaned);

        const sorted = parsed.rankings.sort((a, b) => a.rank - b.rank).map(r => ({ ...r, aiMeta: { source: 'ai' } }));
        if (sorted.length === seasons.length) {
            await setCachedData(cacheKey, sorted);
        }
        return sorted;
    } catch (error: any) {
        // Safe logging to avoid source map errors
        console.log(`AI Season Ranking Error: ${error?.message || String(error)}`);
        // Fallback on any error
        return getSeasonRankingFallback(seasons);
    }
}

export async function* streamSeasonRanking(showTitle: string, seasons: any[], signal?: AbortSignal) {
    const apiKey = getAIKey();
    if (!apiKey) {
        for (const ranking of getSeasonRankingFallback(seasons)) yield ranking;
        return;
    }

    const cacheKey = makeAICacheKey("tv_ranking_v3", showTitle);
    const cached = await getCachedData(cacheKey);
    if (cached) {
        for (const ranking of cached) yield ranking;
        return;
    }

    try {
        consumeAIRateLimit();
    } catch (error) {
        if (!isAIRateLimitError(error)) throw error;
        for (const ranking of getSeasonRankingFallback(seasons, error.rateLimit)) yield ranking;
        return;
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const generated: unknown[] = [];
    const seasonsInfo = seasons.map((season) =>
        `Season ${season.season_number}: ${season.name} - ${season.overview}`
    ).join("\n");

    try {
        const abortSignal = signal
            ? AbortSignal.any([AbortSignal.timeout(45_000), signal])
            : AbortSignal.timeout(45_000);

        const result = streamObject({
            model: google(AI_MODEL),
            output: "array",
            schema: seasonRankingSchema,
            temperature: 0.3,
            maxOutputTokens: 4500,
            abortSignal,
            prompt: `Rank the seasons of "${showTitle}" from best to worst.
Seasons:
${seasonsInfo}
Return every season in rank order with a score, verdict, reason, audience reception, and critics consensus.`,
        });

        for await (const ranking of result.elementStream) {
            const normalized = { ...ranking, aiMeta: { source: "ai" } };
            generated.push(normalized);
            yield normalized;
        }
    } catch (error) {
        console.log("AI Season Ranking Stream Error:", error);
        if (isQuotaError(error)) {
            markAIRateLimited();
        }
        if (!signal?.aborted) {
            for (const ranking of getSeasonRankingFallback(seasons, getAIRateLimitInfo())) yield ranking;
        }
    } finally {
        if (generated.length === seasons.length && !signal?.aborted && !generated.some((item: any) => item.aiMeta?.source === 'fallback' || item.aiMeta?.source === 'rate_limited')) {
            await setCachedData(cacheKey, generated);
        }
    }
}

function getSeasonRankingFallback(seasons: any[], rateLimit?: AIRateLimitInfo) {
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
        aiMeta: rateLimit ? { source: 'rate_limited', rateLimit } : { source: 'fallback' }
    }));
}

export interface ActorAIRecommendationsResult {
    actorMatches: ((Movie | TVSeries) & {
        aiMeta: AIRecommendation;
        match_score?: number;
        relevance_score?: number;
        reason?: string;
    })[];
    allCredits: (Movie | TVSeries)[];
    actorDetails?: {
        id: number;
        name: string;
        profile_path: string | null;
        known_for_department?: string;
    };
    disclaimer?: string;
    rateLimit?: AIRateLimitInfo;
}

const actorMatchEvaluationSchema = z.object({
    matches: z.array(z.object({
        id: z.number().describe("TMDB ID of the title from candidates"),
        title: z.string().optional(),
        type: z.string().optional(),
        relevance_score: z.number().describe("0 to 100 score on how well it fits the vibe/plot"),
        reason: z.string().describe("Specific reason why this title matches the mood/plot/vibe"),
        target_audience: z.string().optional().describe("Target audience"),
        why_watch: z.string().optional().describe("Why to watch this for the mood"),
        ending_mood: z.string().optional().describe("Ending vibe/feeling"),
        emotional_impact: z.string().optional().describe("Emotional impact"),
        critics_consensus: z.string().optional().describe("Brief consensus summary"),
    })).min(1).max(8),
});

const NON_NARRATIVE_GENRES = new Set([10767, 10763, 10764]);
const NON_NARRATIVE_CHAR_REGEX = /^(self\b|himself\b|herself\b|guest\b|host\b|cameo\b|presenter\b)/i;

function isNonNarrativeCredit(item: any): boolean {
    const genres: number[] = item.genre_ids || [];
    if (genres.some(id => NON_NARRATIVE_GENRES.has(id))) return true;
    const character: string = (item.character || "").trim();
    if (character && NON_NARRATIVE_CHAR_REGEX.test(character)) return true;
    return false;
}

interface MoodTheme {
    theme: string;
    triggers: string[];
    genres: number[];
    keywords: string[];
    reasonTemplate: (title: string, actor: string) => string;
}

const ACTOR_MOOD_TAXONOMY: MoodTheme[] = [
    {
        theme: "spicy",
        triggers: ["spicy", "steamy", "erotic", "sexy", "sensual", "hot", "passion", "provocative", "desire", "intimate", "lust", "seductive", "seduction", "romantic", "romance", "affair", "infidelity"],
        genres: [10749, 18, 53], // Romance, Drama, Thriller
        keywords: ["erotic", "passion", "desire", "sensual", "intimate", "provocative", "lust", "seduction", "affair", "relationship", "obsession", "temptation", "sex", "lovers", "intimacy"],
        reasonTemplate: (title, actor) => `A passionate, sensual drama featuring ${actor} that directly embodies this spicy romantic vibe.`,
    },
    {
        theme: "cyberpunk",
        triggers: ["cyberpunk", "hacker", "hack", "simulation", "dystopian", "scifi", "sci-fi", "futuristic", "ai", "virtual", "cyborg", "tech-noir"],
        genres: [878, 28, 53],
        keywords: ["cyberpunk", "hacker", "simulation", "virtual", "reality", "rebels", "dystopian", "technology", "artificial", "future", "cyborg", "android", "cybernetics", "neural"],
        reasonTemplate: (title, actor) => `A landmark sci-fi entry featuring ${actor} with high-tech dystopian and virtual reality themes.`,
    },
    {
        theme: "dark_thriller",
        triggers: ["dark", "gritty", "noir", "crime", "detective", "murder", "killer", "investigation", "mystery", "psychological", "suspense", "mind-bending", "trippy"],
        genres: [80, 53, 9648, 18],
        keywords: ["crime", "murder", "detective", "mystery", "killer", "noir", "underworld", "conspiracy", "corruption", "dark", "gritty", "danger", "secret", "psychological", "suspense", "simulation"],
        reasonTemplate: (title, actor) => `A gripping dark drama featuring ${actor} immersed in mystery, tension, and high-stakes conflict.`,
    },
    {
        theme: "comedy",
        triggers: ["funny", "hilarious", "comedy", "humor", "laugh", "silly", "satire", "parody", "goofy", "fun"],
        genres: [35],
        keywords: ["comedy", "hilarious", "humor", "joke", "funny", "laugh", "comic", "parody", "satire", "friends", "goofy", "amusing", "witty"],
        reasonTemplate: (title, actor) => `A crowd-pleasing comedy showcasing ${actor}'s wit, humor, and comedic timing.`,
    },
    {
        theme: "horror",
        triggers: ["horror", "scary", "spooky", "creepy", "slasher", "gore", "gory", "brutal", "zombie", "monster", "demon", "blood", "massacre"],
        genres: [27, 53],
        keywords: ["horror", "terror", "nightmare", "demon", "monster", "slasher", "blood", "gore", "massacre", "zombie", "haunted", "witch", "evil", "supernatural", "frightening"],
        reasonTemplate: (title, actor) => `A chilling horror entry with ${actor} facing intense dread, tension, and terrifying stakes.`,
    },
    {
        theme: "tearjerker",
        triggers: ["tearjerker", "sad", "crying", "emotional", "heartbreaking", "melancholy", "poignant", "tragedy"],
        genres: [18, 10749],
        keywords: ["tear", "grief", "loss", "death", "terminal", "heartbreak", "tragedy", "poignant", "melancholy", "struggle", "emotional", "sorrow", "mourning"],
        reasonTemplate: (title, actor) => `A deeply moving drama highlighting ${actor}'s poignant, emotional performance.`,
    },
    {
        theme: "action",
        triggers: ["action", "badass", "explosive", "adrenaline", "fight", "combat", "martial", "stunt", "hero", "agent", "assassin", "chase"],
        genres: [28, 12, 10759],
        keywords: ["action", "assassin", "agent", "chase", "combat", "fight", "explosion", "weapon", "mission", "revenge", "adrenaline", "warrior", "tactical"],
        reasonTemplate: (title, actor) => `An adrenaline-fueled action showcase featuring ${actor} in high-octane sequences.`,
    },
    {
        theme: "cozy",
        triggers: ["cozy", "wholesome", "feel-good", "uplifting", "heartwarming", "family", "sweet", "charming"],
        genres: [10751, 35, 10749],
        keywords: ["heartwarming", "friendship", "family", "uplifting", "sweet", "charming", "cozy", "inspiring", "feel-good", "comforting", "gentle"],
        reasonTemplate: (title, actor) => `A heartwarming, feel-good story that highlights ${actor}'s charming and uplifting screen presence.`,
    },
];

const QUERY_STOP_WORDS_REGEX = /\b(movies?|tv|shows?|series|films?|of|her|him|she|he|them|their|his|starring|with|by|in|actor|actress|like|about|for|watch|give|me|recommend|recommendation|recommendations|something|good|best|a|an|the)\b/gi;

interface FallbackCacheEntry {
    data: ActorAIRecommendationsResult;
    expiresAt: number;
}
const actorFallbackCache = new Map<string, FallbackCacheEntry>();

export function clearActorFallbackCache() {
    actorFallbackCache.clear();
}

export async function getActorRecommendations(
    actorId: number,
    actorName: string,
    mood: string,
    signal?: AbortSignal,
    existingCredits?: any[],
    existingPerson?: any
): Promise<ActorAIRecommendationsResult> {
    const cleanMood = mood.trim().slice(0, 250);
    const cleanName = actorName.trim().slice(0, 100);

    if (!cleanMood || !cleanName || !Number.isFinite(actorId)) {
        return { actorMatches: [], allCredits: [] };
    }

    const cacheKey = makeAICacheKey("ai_actor_recs_v3", `${actorId}_${cleanMood}`);
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    const fallbackCached = actorFallbackCache.get(cacheKey);
    if (fallbackCached && fallbackCached.expiresAt > Date.now()) {
        return fallbackCached.data;
    }

    const [personDetails, rawCredits] = await Promise.all([
        existingPerson !== undefined
            ? Promise.resolve(existingPerson)
            : movieService.getPersonDetails(actorId, signal).catch(() => null),
        existingCredits !== undefined
            ? Promise.resolve(existingCredits)
            : movieService.getPersonCombinedCredits(actorId, signal).catch(() => []),
    ]);
    const seen = new Set<string>();
    const allCredits: (Movie | TVSeries)[] = [];

    const safeRawCredits = Array.isArray(rawCredits) ? rawCredits : [];
    for (const credit of safeRawCredits) {
        if (!credit || !credit.id) continue;
        const key = `${credit.media_type || "movie"}-${credit.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            allCredits.push(credit);
        }
    }

    if (allCredits.length === 0) {
        return {
            actorMatches: [],
            allCredits: [],
            actorDetails: {
                id: actorId,
                name: personDetails?.name || cleanName,
                profile_path: personDetails?.profile_path || null,
                known_for_department: personDetails?.known_for_department || "Acting",
            },
            disclaimer: `No credits found on TMDB for ${cleanName}.`,
        };
    }

    // Pre-filter candidates: exclude talk shows and self appearances unless no narrative credits exist
    const narrativeCredits = allCredits.filter(c => !isNonNarrativeCredit(c));
    const pool = narrativeCredits.length > 0 ? narrativeCredits : allCredits;

    // Candidates for LLM evaluation, enriched with genre names
    const candidates = pool.slice(0, 25).map((item) => {
        const isTV = item.media_type === "tv" || "name" in item;
        const title = isTV ? (item as TVSeries).name : (item as Movie).title;
        const year = isTV
            ? (item as TVSeries).first_air_date?.slice(0, 4) || ""
            : (item as Movie).release_date?.slice(0, 4) || "";
        const genres = (item.genre_ids || [])
            .map((id: number) => getGenreName(id))
            .filter((name: string) => name !== "Unknown");

        return {
            id: item.id,
            title,
            type: isTV ? ("tv" as const) : ("movie" as const),
            year,
            genres,
            genre_ids: item.genre_ids || [],
            overview: (item.overview || "").slice(0, 200),
            character: (item as any).character || "",
            popularity: item.popularity || 0,
            vote_average: item.vote_average || 0,
        };
    });

    const apiKey = getAIKey();
    let isFallback = !apiKey;
    let rateLimitInfo: AIRateLimitInfo | undefined;

    if (!isFallback) {
        try {
            consumeAIRateLimit();
        } catch (error) {
            if (isAIRateLimitError(error)) {
                isFallback = true;
                rateLimitInfo = error.rateLimit;
            } else {
                throw error;
            }
        }
    }

    let evaluatedMatches: any[] = [];

    if (!isFallback && apiKey) {
        try {
            const google = createGoogleGenerativeAI({ apiKey });
            const abortSignal = signal
                ? AbortSignal.any([AbortSignal.timeout(45_000), signal])
                : AbortSignal.timeout(45_000);

            const prompt = `You are a film and television expert curator.
The user wants recommendations performed by the actor/actress "${cleanName}" that match this vibe/plot/mood context:
"${cleanMood}"

Query interpretation instructions:
1. Referential pronouns: Phrases like "of her", "of him", "starring her", "with him", "her movies" refer directly to "${cleanName}". Focus on the descriptive mood and genre intent.
2. Colloquial & semantic mood interpretation:
   - "spicy" / "steamy" / "hot" refers to erotic romance, sensual drama, intimate passion, or provocative relationships.
   - "tearjerker" / "sad" refers to poignant emotional drama or tragedy.
   - "mind-bending" / "trippy" refers to psychological thriller, surreal mystery, or complex sci-fi.
   - "cozy" / "feel-good" refers to lighthearted romance, heartwarming comedy, or family drama.
   Interpret slang, vibes, and colloquial expressions according to their emotional and thematic meaning in film.
3. Candidate list:
${JSON.stringify(candidates)}

Selection instructions:
- Select up to 8 titles from the candidate list that best embody this vibe or plot.
- For each selected title, use its exact TMDB id from the list.
- If ${cleanName} has works that strongly fit the requested mood/vibe, prioritize them with high scores (80-98) based on thematic resonance.
- If ${cleanName} does NOT have works that strongly match this vibe (e.g. asking for slasher horror for an actor with only romcoms), pick the 3-5 closest titles, but be honest and score them appropriately lower (< 60).
- Fill in reason specifically for each title.`;

            const { object } = await generateObject({
                model: (google as any)(AI_MODEL, { thinkingConfig: { thinkingBudget: 0 } }),
                schema: actorMatchEvaluationSchema,
                temperature: 0.3,
                abortSignal,
                prompt,
            });

            evaluatedMatches = object.matches || [];
        } catch (error: any) {
            console.error("AI Actor Evaluation Error:", error);
            if (isQuotaError(error)) {
                markAIRateLimited();
                rateLimitInfo = getAIRateLimitInfo();
            }
            isFallback = true;
        }
    }

    // Semantic fallback if AI was unavailable, rate-limited, timed out, or failed
    if (isFallback || evaluatedMatches.length === 0) {
        const queryLower = cleanMood.toLowerCase();
        const rawWords = queryLower
            .replace(QUERY_STOP_WORDS_REGEX, " ")
            .split(/[\s,.-]+/)
            .map(w => w.trim())
            .filter(w => w.length >= 3);

        const matchedThemes = ACTOR_MOOD_TAXONOMY.filter(t =>
            t.triggers.some(tr => queryLower.includes(tr) || rawWords.includes(tr))
        );

        const scoredCandidates = candidates.map(c => {
            const text = `${c.title} ${c.overview || ""} ${c.character || ""}`.toLowerCase();
            let score = (matchedThemes.length > 0 || rawWords.length > 0) ? 40 : 35;

            // Direct salient word matching
            for (const w of rawWords) {
                if (c.title.toLowerCase().includes(w)) {
                    score += 25;
                } else if (text.includes(w)) {
                    score += 15;
                }
            }

            // Theme-based genre and keyword expansion
            for (const theme of matchedThemes) {
                for (const g of theme.genres) {
                    if (c.genre_ids.includes(g)) score += 18;
                }
                for (const kw of theme.keywords) {
                    if (text.includes(kw)) {
                        score += 10;
                    }
                }
            }

            // Media type preference if requested in query
            if (/\b(movies?|films?)\b/i.test(cleanMood) && c.type === "movie") score += 5;
            if (/\b(tv|shows?|series)\b/i.test(cleanMood) && c.type === "tv") score += 5;

            const finalScore = Math.min(96, Math.max(25, score));

            const reason = matchedThemes[0]
                ? (finalScore >= 60
                    ? matchedThemes[0].reasonTemplate(c.title, cleanName)
                    : `Closest work in ${cleanName}'s filmography, though thematic overlap with "${cleanMood}" is limited.`)
                : `Prominent work in ${cleanName}'s filmography matching themes around "${cleanMood}".`;

            return {
                id: c.id,
                title: c.title,
                type: c.type,
                relevance_score: finalScore,
                reason,
                target_audience: "Fans of " + cleanName,
                why_watch: `Showcases ${cleanName}'s performance in this genre.`,
                ending_mood: "Reflective",
                emotional_impact: "Engaging",
                critics_consensus: "A notable entry in the actor's repertoire.",
            };
        });

        scoredCandidates.sort((a, b) => b.relevance_score - a.relevance_score);
        evaluatedMatches = scoredCandidates.slice(0, 8);
    }

    // Merge evaluated matches with original full TMDB data
    const actorMatches: ((Movie | TVSeries) & {
        aiMeta: AIRecommendation;
        match_score?: number;
        relevance_score?: number;
        reason?: string;
    })[] = [];
    const matchedKeys = new Set<string>();

    for (const match of evaluatedMatches) {
        const targetType = normalizeMediaType(match.type);
        const fullItem = allCredits.find(c => c.id === match.id && (c.media_type === targetType || (targetType === "tv" ? "first_air_date" in c : "release_date" in c)))
            || allCredits.find(c => c.id === match.id);
        if (!fullItem) continue;

        const normalizedType: "movie" | "tv" = (fullItem.media_type === "movie" || fullItem.media_type === "tv")
            ? fullItem.media_type
            : targetType;

        const matchKey = `${normalizedType}:${match.id}`;
        if (matchedKeys.has(matchKey)) continue;
        matchedKeys.add(matchKey);

        const normalizedScore = normalizeScore(match.relevance_score);

        actorMatches.push({
            ...fullItem,
            media_type: normalizedType,
            match_score: normalizedScore,
            relevance_score: normalizedScore,
            reason: match.reason,
            aiMeta: {
                title: match.title || (normalizedType === "tv" ? (fullItem as TVSeries).name : (fullItem as Movie).title) || "",
                type: normalizedType,
                reason: match.reason,
                relevance_score: normalizedScore,
                target_audience: match.target_audience,
                why_watch: match.why_watch,
                ending_mood: match.ending_mood,
                emotional_impact: match.emotional_impact,
                critics_consensus: match.critics_consensus,
                source: isFallback ? (rateLimitInfo ? "rate_limited" : "fallback") : "ai",
                rateLimit: rateLimitInfo,
            },
        });
    }

    actorMatches.sort((a, b) => (b.aiMeta.relevance_score || 0) - (a.aiMeta.relevance_score || 0));

    // Check if max score is below 60 to add friendly disclaimer
    let disclaimer: string | undefined;
    const maxScore = actorMatches.length > 0 ? Math.max(...actorMatches.map(m => m.aiMeta.relevance_score)) : 0;
    if (maxScore > 0 && maxScore < 60) {
        disclaimer = `No works strongly match "${cleanMood}" in ${cleanName}'s filmography. Showing their closest works below.`;
    }

    const result: ActorAIRecommendationsResult = {
        actorMatches,
        allCredits,
        actorDetails: {
            id: actorId,
            name: personDetails?.name || cleanName,
            profile_path: personDetails?.profile_path || null,
            known_for_department: personDetails?.known_for_department || "Acting",
        },
        disclaimer,
        rateLimit: rateLimitInfo,
    };

    if (!isFallback && actorMatches.length > 0) {
        await setCachedData(cacheKey, result);
    } else if (actorMatches.length > 0) {
        // Cache fallback results with a reasonable TTL (5 minutes) so repeated queries don't re-execute
        actorFallbackCache.set(cacheKey, {
            data: result,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });
    }

    return result;
}
