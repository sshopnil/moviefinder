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

    searchMulti: async (query: string): Promise<{ movies: Movie[], people: any[] }> => {
        if (!query) return { movies: [], people: [] };
        const data = await fetchFromTMDB<{ results: any[] }>("/search/multi", { query });

        const movies = data.results.filter((item: any) => item.media_type === "movie") as Movie[];
        const people = data.results.filter((item: any) => item.media_type === "person");

        return { movies, people };
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

    getDiscover: async (filters: {
        with_genres?: string;
        primary_release_year?: string;
        "vote_average.gte"?: string;
        with_runtime_gte?: string;
        with_runtime_lte?: string;
    }): Promise<Movie[]> => {
        // Remove undefined keys
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/movie", params);
        return data.results;
    },

    getMovieImages: async (id: number): Promise<{ backdrops: any[]; posters: any[] }> => {
        const data = await fetchFromTMDB<{ backdrops: any[]; posters: any[] }>(`/movie/${id}/images`, {
            include_image_language: "en,null",
        });
        return data;
    },

    getPersonDetails: async (id: number): Promise<any> => {
        return fetchFromTMDB<any>(`/person/${id}`);
    },

    getPersonCredits: async (id: number): Promise<Movie[]> => {
        const data = await fetchFromTMDB<{ cast: Movie[] }>(`/person/${id}/movie_credits`);
        // Sort by popularity or vote count to show best movies first
        return data.cast.sort((a, b) => b.popularity - a.popularity).slice(0, 20);
    }
};
