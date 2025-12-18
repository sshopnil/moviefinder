import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

const recommendationSchema = z.object({
    recommendations: z.array(z.object({
        title: z.string(),
        type: z.enum(["movie", "tv"]),
        reason: z.string().describe("1-sentence reason why this matches the mood"),
        relevance_score: z.number().min(0).max(100).describe("How well it matches the mood (0-100)"),
        target_audience: z.string().describe("Who this movie/show is primarily for (e.g. 'Hopeless romantics', 'Thrill seekers')"),
        why_watch: z.string().describe("A compelling 1-sentence reason to watch it"),
        ending_mood: z.string().describe("The mood this will leave the viewer in (e.g. 'Bittersweet but hopeful')"),
        emotional_impact: z.string().describe("How the viewer will feel (e.g. 'Deeply moved and reflective')"),
        critics_consensus: z.string().describe("A brief summary of what critics generally say")
    })).min(1).max(20)
});

const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

export async function getRecommendationsFromMood(mood: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn("GROQ_API_KEY missing");
        return [
            {
                title: "Inception",
                type: "movie" as const,
                reason: "Mind-bending heist",
                relevance_score: 95,
                target_audience: "Sci-fi lovers and puzzle solvers",
                why_watch: "It's a visual masterpiece with a complex, rewarding narrative.",
                ending_mood: "Intellectually stimulated and curious",
                emotional_impact: "Awe-struck and slightly confused",
                critics_consensus: "Visionary, complex, and technically stunning."
            },
            {
                title: "The Bear",
                type: "tv" as const,
                reason: "Intense kitchen drama",
                relevance_score: 90,
                target_audience: "Fans of high-stakes character-driven drama",
                why_watch: "The performances are electric and the pace is relentless.",
                ending_mood: "Exhausted but satisfied",
                emotional_impact: "Stressed but empathetic",
                critics_consensus: "A chaotic, beautifully acted look at grief and ambition."
            }
        ];
    }

    const model = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
    });

    const prompt = new PromptTemplate({
        template: `You are an expert movie and TV series connoisseur. 
Given the user's current mood: "{mood}", suggest a ranked list of exactly 15-20 movies and TV series that deeply resonate with or complement this emotional state.

Instructions:
1. Curate the list to strongly reflect the given mood.
2. Ensure a rich mix of global cinema (South Asian, East Asian, European, etc.).
3. Rank them by relevance to the mood.
4. Include both movies and TV series.
5. For each suggestion, provide:
   - A brief reason for the match.
   - The target audience.
   - A compelling reason to watch.
   - The vibe/mood the viewer will be in by the end.
   - How the viewer will feel.
   - A brief critics' consensus.
6. Return the results in the following format:
{format_instructions}

Mood: {mood}`,
        inputVariables: ["mood"],
        partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const input = await prompt.format({ mood });

    try {
        const response = await model.invoke(input);
        const parsed = await parser.parse(response.content as string);
        // Slice to 20 for consistency and sort by relevance
        return parsed.recommendations
            .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
            .slice(0, 20);
    } catch (error) {
        console.error("AI Recommendation Error:", error);
        return [];
    }
}

export async function getMovieVerdict(title: string, ratings: any, reviews: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const model = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
    });

    try {
        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5).map((r: any) => r.content.substring(0, 200)).join(" | ");

        const prompt = `Analyze the reception for the title "${title}".
            Ratings: ${ratingsSummary}
            User Reviews Snippets: ${reviewsSummary}

            Based on this, act as a witty movie buff friend. focus on general consensus. Focus on the impact on viewers.
            Return ONLY a valid JSON object with keys "verdict" and "reason".`;

        const response = await model.invoke(prompt);
        // Basic cleaning if LLM returns markdown blocks
        const text = (response.content as string).replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Verdict Error:", error);
        return null;
    }
}

export async function getShowRecommendations(showTitle: string, overview: string, genres: string[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];

    const model = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
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
            relevance_score: z.number()
        }))
    });

    const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

    const prompt = `The user is currently watching or looking at "${showTitle}".
        Overview: ${overview}
        Genres: ${genres.join(", ")}

        Suggest exactly 10 similar movies or TV series that they would enjoy if they liked this.
        Focus on similar themes, tone, and emotional impact.
        
        ${parser.getFormatInstructions()}`;

    try {
        const response = await model.invoke(prompt);
        const text = (response.content as string).replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = await parser.parse(text);
        return parsed.recommendations;
    } catch (error) {
        console.error("AI Show Recommendations Error:", error);
        return [];
    }
}

export async function getSeasonRanking(showTitle: string, seasons: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const model = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
    });

    const rankingSchema = z.object({
        rankings: z.array(z.object({
            season_number: z.number(),
            rank: z.number(),
            score: z.number().describe("Score out of 100 based on general consensus"),
            verdict: z.string().describe("A short, catchy verdict (e.g., 'Masterpiece', 'Slight Dip')"),
            reason: z.string().describe("Why it is ranked here, mentioning specific high points or low points"),
            audience_reception: z.string(),
            critics_consensus: z.string()
        }))
    });

    const parser = StructuredOutputParser.fromZodSchema(rankingSchema);

    const seasonsInfo = seasons.map(s => `Season ${s.season_number}: ${s.name} - ${s.overview}`).join("\n");

    const prompt = `For the TV show "${showTitle}", rank the following seasons from best to worst based on overall quality, critical reception, and audience viewer sentiment.
        Consider all available knowledge about the public perception of these seasons.
        
        Seasons to rank:
        ${seasonsInfo}
        
        ${parser.getFormatInstructions()}`;

    try {
        const response = await model.invoke(prompt);
        const text = (response.content as string).replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = await parser.parse(text);
        return parsed.rankings.sort((a, b) => a.rank - b.rank);
    } catch (error) {
        console.error("AI Season Ranking Error:", error);
        return null;
    }
}
