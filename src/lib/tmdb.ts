// const TMDB_API_KEY = process.env.TMDB_API_KEY; // Moved inside function for runtime safety
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

import { Movie, MovieDetails, MovieResponse } from "@/types/movie";

export const TMDB_IMAGE_URL = {
    poster: (path: string | null) => path ? `${IMAGE_BASE_URL}/w500${path}` : "/placeholder-poster.png",
    backdrop: (path: string | null) => path ? `${IMAGE_BASE_URL}/original${path}` : "/placeholder-backdrop.png",
    profile: (path: string | null) => path ? `${IMAGE_BASE_URL}/w185${path}` : "/placeholder-profile.png",
};

async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.warn("TMDB_API_KEY is missing. Returning mock data or empty results.");
        // In a real scenario, we might want to throw an error or handle this gracefully.
        // For now, let's assume the user will provide the key.
        // return {} as T; 
    }

    const queryParams = new URLSearchParams({
        api_key: apiKey || "",
        language: "en-US",
        ...params,
    });

    const response = await fetch(`${BASE_URL}${endpoint}?${queryParams.toString()}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
        throw new Error(`TMDB API Error: ${response.statusText}`);
    }

    return response.json();
}

export const movieService = {
    getTrending: async (): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/trending/movie/week");
        return data.results;
    },

    getPopular: async (): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/movie/popular");
        return data.results;
    },

    searchMovies: async (query: string): Promise<Movie[]> => {
        if (!query) return [];
        const data = await fetchFromTMDB<MovieResponse>("/search/movie", { query });
        return data.results;
    },

    getMovieDetails: async (id: number): Promise<MovieDetails> => {
        const data = await fetchFromTMDB<MovieDetails>(`/movie/${id}`, {
            append_to_response: "credits,videos",
        });
        // Transform credits to simpler cast array
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast };
    },

    getDiscover: async (with_genres?: string): Promise<Movie[]> => {
        const params: Record<string, string> = {};
        if (with_genres) params.with_genres = with_genres;
        const data = await fetchFromTMDB<MovieResponse>("/discover/movie", params);
        return data.results;
    }
};
