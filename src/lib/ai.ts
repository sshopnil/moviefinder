import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function getRecommendationsFromMood(mood: string) {
    if (!GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY missing");
        // Mock response for dev without keys
        return ["Inception", "The Grand Budapest Hotel", "Inside Out", "The Dark Knight", "Amélie"];
    }

    try {
        const { object } = await generateObject({
            model: google("gemini-1.5-flash"),
            schema: z.object({
                movies: z.array(z.string()).describe("List of 5 movie titles that perfectly match the mood"),
                reasoning: z.string().describe("Brief explanation of why these movies fit the mood"),
            }),
            prompt: `Suggest 5 movies for a user who is feeling: "${mood}". 
      Focus on a mix of hidden gems and classics. 
      Return only the movie titles in the array.`,
        });

        return object.movies;
    } catch (error) {
        console.error("AI Error:", error);
        return [];
    }
}
