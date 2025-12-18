"use server";

import { movieService } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { Movie, MovieDetails, AIRecommendation } from "@/types/movie";

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

export async function searchMultiAction(query: string, page: number = 1) {
    try {
        return await movieService.searchMulti(query, page);
    } catch (error) {
        console.error("Failed to multi search:", error);
        return { movies: [], tv: [], people: [], total_pages: 0, total_results: 0 };
    }
}

export async function getRecommendationsAction(mood: string): Promise<Movie[]> {
    try {
        const titles = await getRecommendationsFromMood(mood);
        if (!titles.length) return [];

        // Parallel fetch for details
        const moviePromises = titles.map(async (rec: AIRecommendation) => {
            const results = await movieService.searchMovies(rec.title);
            return results[0];
        });

        const movies = (await Promise.all(moviePromises)).filter(Boolean);
        return movies;
    } catch (error) {
        console.error("Failed to get AI recommendations:", error);
        return [];
    }
}
