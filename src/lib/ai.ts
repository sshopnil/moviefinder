import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

const recommendationSchema = z.object({
    recommendations: z.array(z.object({
        title: z.string(),
        type: z.enum(["movie", "tv"]),
        reason: z.string().describe("1-sentence reason why this matches the mood"),
        relevance_score: z.number().min(0).max(100).describe("How well it matches the mood (0-100)")
    })).min(1).max(30)
});

const parser = StructuredOutputParser.fromZodSchema(recommendationSchema);

export async function getRecommendationsFromMood(mood: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn("GROQ_API_KEY missing");
        return [
            { title: "Inception", type: "movie" as const, reason: "Mind-bending heist", relevance_score: 95 },
            { title: "The Bear", type: "tv" as const, reason: "Intense kitchen drama", relevance_score: 90 }
        ];
    }

    const model = new ChatGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
    });

    const prompt = new PromptTemplate({
        template: `You are an expert movie and TV series connoisseur. 
Given the user's current mood: "{mood}", suggest a ranked list of exactly 20 movies and TV series that deeply resonate with or complement this emotional state.

Instructions:
1. Curate the list to strongly reflect the given mood.
2. Ensure a rich mix of global cinema (South Asian, East Asian, European, etc.).
3. Rank them by relevance to the mood.
4. Include both movies and TV series.
5. Provide a brief (1-sentence) reason for each.
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
