"use server";

import { movieService, tvService } from "@/lib/tmdb";
import { AIRateLimitInfo, getRecommendationsFromMood, getShowRecommendations, getSeasonRanking, getSimilarContent, isAIRateLimitError } from "@/lib/ai";
import { Movie, MovieDetails, AIRecommendation, TVSeries } from "@/types/movie";

type AIActionResult<T> = {
    data: T;
    rateLimit?: AIRateLimitInfo;
};

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
        // Deduplicate
        return Array.from(new Map(movies.map(m => [m.id, m])).values());
    } catch (error) {
        console.error("Failed to get AI recommendations:", error);
        return [];
    }
}

export async function getMoodRecommendationsAction(mood: string): Promise<AIActionResult<any[]>> {
    try {
        return { data: await getRecommendationsFromMood(mood) };
    } catch (error) {
        if (isAIRateLimitError(error)) {
            return { data: [], rateLimit: error.rateLimit };
        }
        console.error("Failed to get raw AI mood recommendations:", error);
        return { data: [] };
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

        const validResults = results.filter(Boolean);
        // Deduplicate
        return Array.from(new Map(validResults.map(item => [item.id, item])).values());
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

export async function getSimilarContentAction(title: string, overview: string, genres: string[], type: 'movie' | 'tv' = 'movie', tmdbId?: number): Promise<AIActionResult<any[]>> {
    try {
        const recommendations = await getSimilarContent(title, overview, genres, type, tmdbId);
        if (!recommendations.length) return { data: [] };

        // Hydrate with TMDB data
        const results = await Promise.all(
            recommendations.map(async (rec: any) => {
                let mediaData: any = null;
                if (rec.type === "movie") {
                    const matches = await movieService.searchMovies(rec.title);
                    mediaData = matches[0] ? { ...matches[0], media_type: "movie" as const } : null;
                } else {
                    const matches = await tvService.searchTV(rec.title);
                    mediaData = matches[0] ? { ...matches[0], media_type: "tv" as const } : null;
                }

                if (mediaData) {
                    return {
                        ...mediaData,
                        aiMeta: rec
                    };
                }
                return null;
            })
        );

        const validResults = results.filter(Boolean);
        // Deduplicate
        return { data: Array.from(new Map(validResults.map(item => [item.id, item])).values()) };
    } catch (error) {
        if (isAIRateLimitError(error)) {
            return { data: [], rateLimit: error.rateLimit };
        }
        console.error("Failed to get similar content:", error);
        return { data: [] };
    }
}
