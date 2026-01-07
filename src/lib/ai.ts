import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import AICache from "@/models/AICache";
import dbConnect from "@/lib/db";

// Initialize the Google provider with the specific API key from the environment
const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const MODEL_NAME = "gemini-flash-latest";

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

export async function getRecommendationsFromMood(mood: string) {
    if (!process.env.GEMINI_API_KEY) return [];

    // Removed caching logic here to keep mood recommendations fresh/live
    try {
        const { object } = await generateObject({
            model: google(MODEL_NAME),
            schema: z.object({
                recommendations: z.array(z.object({
                    title: z.string(),
                    type: z.enum(["movie", "tv"]),
                    reason: z.string().describe("1-sentence reason why this matches the mood"),
                    relevance_score: z.number().min(0).max(100).describe("How well it matches the mood (0-100)"),
                    target_audience: z.string().describe("Who this movie/show is primarily for"),
                    why_watch: z.string().describe("A compelling 1-sentence reason to watch it"),
                    ending_mood: z.string().describe("The mood this will leave the viewer in"),
                    emotional_impact: z.string().describe("How the viewer will feel"),
                    critics_consensus: z.string().describe("A brief summary of what critics generally say")
                })).min(1).max(20)
            }),
            prompt: `You are an expert movie and TV series connoisseur. 
Given the user's current mood: "${mood}", suggest a ranked list of exactly 15-20 movies and TV series.

Instructions:
1. Curate the list to strongly reflect the given mood.
2. Ensure a rich mix of global cinema (South Asian, East Asian, European, etc.).
3. Rank them by relevance to the mood.
4. Include both movies and TV series.`,
        });

        const sorted = object.recommendations
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 20);

        // No caching for live recommendations
        return sorted;
    } catch (error) {
        console.error("AI Recommendation Error (Gemini):", error);
        return [];
    }
}

export async function getMovieInsights(id: number | string, title: string, ratings: any, reviews: any[]) {
    if (!process.env.GEMINI_API_KEY) return null;

    // Bumped version to v2 to include critics_consensus
    const cacheKey = `movie_insights_v2_${id}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5).map((r: any) => r.content.substring(0, 200)).join(" | ");

        const { object } = await generateObject({
            model: google(MODEL_NAME),
            schema: z.object({
                verdict: z.string(),
                reason: z.string(),
                for_whom: z.string().describe("Target audience description"),
                feeling: z.string().describe("Emotional impact of the movie"),
                ending_vibe: z.string().describe("The mood at the end of the movie"),
                critics_consensus: z.string().describe("A detailed paragraph summarizing critical reception (approx 4-5 sentences)")
            }),
            prompt: `Analyze the reception for the title "${title}".
            Ratings: ${ratingsSummary}
            User Reviews Snippets: ${reviewsSummary}

            Based on this, act as a witty movie buff friend. 
            Provide:
            1. A general verdict.
            2. A reason for the verdict.
            3. "For Whom": Who specifically would love this?
            4. "Feeling": How does it make you feel?
            5. "Ending Vibe": What is the lingering mood after the credits roll?
            6. "Critics Consensus": A detailed consensus.`,
        });

        await setCachedData(cacheKey, object);
        return object;
    } catch (error) {
        console.error("AI Verdict Error (Gemini):", error);
        return null;
    }
}

// Deprecated alias
export const getMovieVerdict = getMovieInsights;

export async function getShowRecommendations(showTitle: string, overview: string, genres: string[]) {
    if (!process.env.GEMINI_API_KEY) return [];

    const cacheKey = `show_recommendations_${showTitle.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const { object } = await generateObject({
            model: google(MODEL_NAME),
            schema: z.object({
                recommendations: z.array(z.object({
                    title: z.string(),
                    type: z.enum(["movie", "tv"]),
                    reason: z.string(),
                    target_audience: z.string(),
                    why_watch: z.string(),
                    ending_mood: z.string(),
                    emotional_impact: z.string(),
                    critics_consensus: z.string(),
                    relevance_score: z.number()
                }))
            }),
            prompt: `The user is currently watching or looking at "${showTitle}".
            Overview: ${overview}
            Genres: ${genres.join(", ")}

            Suggest exactly 10 similar movies or TV series.
            Focus on similar themes, tone, and emotional impact.`,
        });

        await setCachedData(cacheKey, object.recommendations);
        return object.recommendations;
    } catch (error) {
        console.error("AI Show Recommendations Error (Gemini):", error);
        return [];
    }
}

export async function getSeasonRanking(showTitle: string, seasons: any[]) {
    if (!process.env.GEMINI_API_KEY) return null;

    const cacheKey = `tv_ranking_${showTitle.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const seasonsInfo = seasons.map(s => `Season ${s.season_number}: ${s.name} - ${s.overview}`).join("\n");

        const { object } = await generateObject({
            model: google(MODEL_NAME),
            schema: z.object({
                rankings: z.array(z.object({
                    season_number: z.number(),
                    rank: z.number(),
                    score: z.number(),
                    verdict: z.string(),
                    reason: z.string(),
                    audience_reception: z.string(),
                    critics_consensus: z.string()
                }))
            }),
            prompt: `For the TV show "${showTitle}", rank the following seasons from best to worst based on overall quality, critical reception, and audience viewer sentiment.
            
            Seasons to rank:
            ${seasonsInfo}`,
        });

        const sorted = object.rankings.sort((a, b) => a.rank - b.rank);
        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error) {
        console.error("AI Season Ranking Error (Gemini):", error);
        return null;
    }
}
