"use server";

import { movieService } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { Movie, MovieDetails } from "@/types/movie";

// Actions are async functions that run on the server

export async function getTrendingMoviesAction(): Promise<Movie[]> {
    try {
        return await movieService.getTrending();
    } catch (error) {
        console.error("Failed to fetch trending movies:", error);
        return [];
    }
}

export async function searchMoviesAction(query: string): Promise<Movie[]> {
    try {
        return await movieService.searchMovies(query);
    } catch (error) {
        console.error("Failed to search movies:", error);
        return [];
    }
}

export async function getRecommendationsAction(mood: string): Promise<Movie[]> {
    try {
        const titles = await getRecommendationsFromMood(mood);
        if (!titles.length) return [];

        // Parallel fetch for details
        const moviePromises = titles.map(async (title) => {
            const results = await movieService.searchMovies(title);
            return results[0];
        });

        const movies = (await Promise.all(moviePromises)).filter(Boolean);
        return movies;
    } catch (error) {
        console.error("Failed to get AI recommendations:", error);
        return [];
    }
}
