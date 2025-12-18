"use server";

import { movieService, tvService } from "@/lib/tmdb";
import { getRecommendationsFromMood, getShowRecommendations, getSeasonRanking } from "@/lib/ai";
import { Movie, MovieDetails, AIRecommendation, TVSeries } from "@/types/movie";

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

export async function getShowRecommendationsAction(showTitle: string, overview: string, genres: string[]): Promise<any[]> {
    try {
        const recommendations = await getShowRecommendations(showTitle, overview, genres);
        if (!recommendations.length) return [];

        const results = await Promise.all(
            recommendations.map(async (rec: any) => {
                let movieData: any = null;
                if (rec.type === "movie") {
                    const matches = await movieService.searchMovies(rec.title);
                    movieData = matches[0] ? { ...matches[0], media_type: "movie" as const } : null;
                } else {
                    const matches = await tvService.searchTV(rec.title);
                    movieData = matches[0] ? { ...matches[0], media_type: "tv" as const } : null;
                }

                if (movieData) {
                    return {
                        ...movieData,
                        aiMeta: rec
                    };
                }
                return null;
            })
        );

        return results.filter(Boolean);
    } catch (error) {
        console.error("Failed to get show recommendations:", error);
        return [];
    }
}

export async function getSeasonRankingAction(showTitle: string, seasons: any[]) {
    try {
        return await getSeasonRanking(showTitle, seasons);
    } catch (error) {
        console.error("Failed to get season ranking:", error);
        return null;
    }
}
