import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import AICache from "@/models/AICache";
import dbConnect from "@/lib/db";

// Using Groq Compound
const MODEL_NAME = "groq/compound";

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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    // 1. Caching
    const cacheKey = `ai_mood_recs_v3_${mood.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
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
            type: z.enum(["movie", "tv"]),
            reason: z.string().describe("1-sentence reason why this matches the mood"),
            relevance_score: z.number().min(0).max(100).describe("How well it matches the mood (0-100)"),
            target_audience: z.string().describe("Who this movie/show is primarily for"),
            why_watch: z.string().describe("A compelling 1-sentence reason to watch it"),
            ending_mood: z.string().describe("The mood this will leave the viewer in"),
            emotional_impact: z.string().describe("How the viewer will feel"),
            critics_consensus: z.string().describe("A brief summary of what critics generally say")
        })).min(1).max(10)
    });

    const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

    const prompt = new PromptTemplate({
        template: `You are an expert movie and TV series connoisseur. 
        Given the user's current mood or query: "{mood}", suggest a ranked list of exactly 10 movies and TV series.

        STRICT INSTRUCTIONS:
        1. BE LITERAL & SPECIFIC.
        2. VIBE MATCHING.
        3. AVOID GENERIC HITS.
        4. MIX GLOBAL & FORMATS.
        5. RANKING: Rank purely by relevance to the "{mood}" query.
        
        Return the results in the following JSON format:
        {format_instructions}`,
        inputVariables: ["mood"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    try {
        const input = await prompt.format({ mood });
        const response = await model.invoke(input);

        let text = response.content as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const parsed = await parser.parse(text);

        const sorted = parsed.recommendations
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

    const cacheKey = `movie_insights_v2_${id}`;
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
        for_whom: z.string().describe("Target audience description"),
        feeling: z.string().describe("Emotional impact of the movie"),
        ending_vibe: z.string().describe("The mood at the end of the movie"),
        critics_consensus: z.string().describe("A detailed paragraph summarizing critical reception (approx 4-5 sentences)")
    });

    const parser = StructuredOutputParser.fromZodSchema(insightsSchema);

    try {
        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5).map((r: any) => r.content.substring(0, 200)).join(" | ");

        const prompt = new PromptTemplate({
            template: `Analyze the reception for the title "{title}".
            Ratings: {ratingsSummary}
            User Reviews Snippets: {reviewsSummary}

            Based on this, act as a witty movie buff friend. 
            Provide: Verdict, Reason, For Whom, Feeling, Ending Vibe, Critics Consensus.
            
            {format_instructions}`,
            inputVariables: ["title", "ratingsSummary", "reviewsSummary"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ title, ratingsSummary, reviewsSummary });
        const response = await model.invoke(input);

        let text = response.content as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const parsed = await parser.parse(text);

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

    const cacheKey = `ai_similar_${type}_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
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
            type: z.enum(["movie", "tv"]),
            reason: z.string(),
            target_audience: z.string(),
            why_watch: z.string(),
            ending_mood: z.string(),
            emotional_impact: z.string(),
            critics_consensus: z.string(),
            relevance_score: z.number().min(0).max(100).describe("Percentage of match (0-100). Should be high (80-100) for good recommendations.")
        }))
    });

    const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

    const prompt = new PromptTemplate({
        template: `The user is currently executing a detailed deep dive into the {type} "{title}".
        Overview: {overview}
        Genres: {genres}

        Suggest exactly 10 similar movies or TV series that a fan of this would ABSOLUTELY LOVE.
        Focus on matching the specific *vibe*, *tone*, and *emotional impact*.
        
        CRITICAL: Do NOT include "{title}" in the recommendations.
        IMPORTANT: Assign a 'relevance_score' between 85 and 100 for these top recommendations.
        
        {format_instructions}`,
        inputVariables: ["type", "title", "overview", "genres"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    try {
        const input = await prompt.format({ type, title, overview, genres: genres.join(", ") });
        const response = await model.invoke(input);

        let text = response.content as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const parsed = await parser.parse(text);

        const sorted = parsed.recommendations
            .filter(r => r.title.toLowerCase() !== title.toLowerCase())
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

    const cacheKey = `tv_ranking_${showTitle.toLowerCase().replace(/\s+/g, '_')}`;
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
            template: `For the TV show "{showTitle}", rank the following seasons from best to worst based on overall quality.
            
            Seasons to rank:
            {seasonsInfo}
            
            {format_instructions}`,
            inputVariables: ["showTitle", "seasonsInfo"],
            partialVariables: { format_instructions: parser.getFormatInstructions() },
        });

        const input = await prompt.format({ showTitle, seasonsInfo });
        const response = await model.invoke(input);

        let text = response.content as string;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const parsed = await parser.parse(text);

        const sorted = parsed.rankings.sort((a, b) => a.rank - b.rank);
        await setCachedData(cacheKey, sorted);
        return sorted;
    } catch (error) {
        console.error("AI Season Ranking Error (Groq):", error);
        return null;
    }
}
