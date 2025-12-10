import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export async function getRecommendationsFromMood(mood: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.warn("GROQ_API_KEY missing");
        // Mock response for dev without keys or if key is not set
        return ["Inception", "The Grand Budapest Hotel", "Inside Out", "The Dark Knight", "Amélie"];
    }

    const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey,
    });

    try {
        const { text } = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            prompt: `Given the user's current mood: "${mood}", suggest all movies that deeply resonate with or complement this emotional state.

Instructions:
1. Output only a valid JSON object with a single key "movies", mapping to an array of exactly 40 movie titles.
2. Curate the list to strongly reflect the given mood — this should be the primary selection criteria.
3. Ensure a rich mix of:
   - Hidden gems
   - Critically acclaimed classics
   - Artistic masterpieces
4. Include titles from a wide range of global cinema: South Asian (Hindi, Tamil, Telugu, Malayalam, Bengali), East Asian (Korean, Japanese, Chinese), European, Latin American, African, and more. Avoid limiting to English or Hollywood films.
5. Do not include any commentary or explanation outside the JSON.

Example output:
{ "movies": ["Tokyo Story", "A Separation", "Mahanagar", "Burning", "The Great Beauty", "...15 more"] }
`,
            maxRetries: 1,
        });

        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        return Array.isArray(parsed.movies) ? parsed.movies : [];
    } catch (error) {
        console.error("AI Error:", error);
        // Fallback to a diverse list of high-quality movies when AI quota is exceeded or fails
        return ["The Shawshank Redemption", "Spirited Away", "Parasite", "The Grand Budapest Hotel", "La La Land"];
    }
}

export async function getMovieVerdict(title: string, ratings: any, reviews: any[]) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey,
    });

    try {
        // Summarize inputs for the prompt
        const ratingsSummary = JSON.stringify(ratings || "No external ratings");
        const reviewsSummary = reviews.slice(0, 5).map((r: any) => r.content.substring(0, 200)).join(" | ");

        const { text } = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            prompt: `Analyze the reception for the movie "${title}".
            Ratings: ${ratingsSummary}
            User Reviews Snippets: ${reviewsSummary}

            Based on this, act as a witty movie buff friend. Do not be biased by personal taste—focus on general consensus. Focus on the ending impact on viewers.
            1. Give a "Verdict": "Must Watch", "Solid Choice", "Only for Fans", or "Skip".
            2. Give a 1-sentence explanation why.
            
            Return ONLY a JSON object: { "verdict": "string", "reason": "string" }`,
            maxRetries: 1,
        });

        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (error) {
        console.error("AI Verdict Error:", error);
        return null;
    }
}
