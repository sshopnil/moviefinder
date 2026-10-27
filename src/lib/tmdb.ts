// const TMDB_API_KEY = process.env.TMDB_API_KEY; // Moved inside function for runtime safety
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

import type { Movie, MovieDetails, MovieResponse, TVSeries, TVDetails } from "../types/movie.ts";

export const TMDB_IMAGE_URL = {
    poster: (path: string | null) => path ? `${IMAGE_BASE_URL}/w500${path}` : "/placeholder-poster.png",
    backdrop: (path: string | null) => path ? `${IMAGE_BASE_URL}/w1280${path}` : "/placeholder-backdrop.png",
    profile: (path: string | null) => path ? `${IMAGE_BASE_URL}/h632${path}` : "/placeholder-profile.png",
    logo: (path: string | null) => path ? `${IMAGE_BASE_URL}/w154${path}` : "/placeholder-icon.png",
};

export class TMDBError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "TMDBError";
        this.status = status;
    }
}

async function fetchFromTMDB<T>(
    endpoint: string,
    params: Record<string, string> = {},
    signal?: AbortSignal
): Promise<T> {
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
        include_adult: "false",
        ...params,
    });

    const timeoutSignal = AbortSignal.timeout(8000);
    const effectiveSignal = signal
        ? AbortSignal.any([timeoutSignal, signal])
        : timeoutSignal;

    const response = await fetch(`${BASE_URL}${endpoint}?${queryParams.toString()}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        signal: effectiveSignal,
        next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
        throw new TMDBError(`TMDB API Error: ${response.status} ${response.statusText}`, response.status);
    }

    return response.json();
}

export const movieService = {
    getTrending: async (signal?: AbortSignal): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/trending/movie/week", {}, signal);
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    },

    getPopular: async (signal?: AbortSignal): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/movie/popular", {}, signal);
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    },

    searchMulti: async (query: string, page: number = 1, signal?: AbortSignal): Promise<{
        movies: Movie[],
        tv: TVSeries[],
        people: any[],
        total_pages: number,
        total_results: number
    }> => {
        if (!query) return { movies: [], tv: [], people: [], total_pages: 0, total_results: 0 };

        const data = await fetchFromTMDB<{
            results: any[],
            total_pages: number,
            total_results: number
        }>("/search/multi", { query, page: page.toString() }, signal);

        const results = data.results || [];
        const movies = results.filter((item: any) => item.media_type === "movie") as Movie[];
        const tv = results.filter((item: any) => item.media_type === "tv") as TVSeries[];
        const people = results.filter((item: any) => item.media_type === "person");

        return {
            movies,
            tv,
            people,
            total_pages: data.total_pages,
            total_results: data.total_results
        };
    },

    searchMovies: async (query: string, page: number = 1, signal?: AbortSignal): Promise<{
        results: Movie[];
        total_pages: number;
        total_results: number;
    }> => {
        if (!query) return { results: [], total_pages: 0, total_results: 0 };
        const data = await fetchFromTMDB<MovieResponse>("/search/movie", { query, page: page.toString() }, signal);
        return {
            results: (data.results || []).map(m => ({ ...m, media_type: "movie" as const })),
            total_pages: data.total_pages || 0,
            total_results: data.total_results || 0,
        };
    },

    searchPeople: async (query: string, signal?: AbortSignal): Promise<any[]> => {
        if (!query) return [];

        const maxPages = 3;
        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        const promises = pages.map(page =>
            fetchFromTMDB<{ results: any[] }>("/search/person", { query, page: page.toString() }, signal)
                .catch(() => ({ results: [] }))
        );

        const results = await Promise.all(promises);
        const allPeople = results.flatMap(r => r.results || []);

        const seen = new Set();
        const uniquePeople = allPeople.filter(p => {
            const duplicate = seen.has(p.id);
            seen.add(p.id);
            return !duplicate;
        });

        return uniquePeople;
    },

    searchKeywords: async (query: string, signal?: AbortSignal): Promise<{ id: number, name: string }[]> => {
        if (!query) return [];
        const data = await fetchFromTMDB<{ results: { id: number, name: string }[] }>("/search/keyword", { query }, signal);
        return data.results || [];
    },

    getMovieDetails: async (id: number, signal?: AbortSignal): Promise<MovieDetails> => {
        const data = await fetchFromTMDB<MovieDetails>(`/movie/${id}`, {
            append_to_response: "credits,videos,external_ids,watch/providers",
        }, signal);
        const imdb_id = (data as any).external_ids?.imdb_id || data.imdb_id;
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return {
            ...data,
            cast,
            imdb_id,
            media_type: "movie",
            watch_providers: (data as any)["watch/providers"]
        };
    },

    getDiscover: async (filters: {
        with_genres?: string;
        with_keywords?: string;
        primary_release_year?: string;
        "vote_average.gte"?: string;
        "vote_count.gte"?: string;
        with_runtime_gte?: string;
        with_runtime_lte?: string;
        with_original_language?: string;
        region?: string;
        sort_by?: string;
        page?: string;
    }, signal?: AbortSignal): Promise<{ results: Movie[], total_pages: number, total_results: number }> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/movie", { ...params }, signal);

        return {
            results: (data.results || []).map(m => ({ ...m, media_type: "movie" as const })),
            total_pages: data.total_pages,
            total_results: data.total_results
        };
    },

    getMovieImages: async (id: number, signal?: AbortSignal): Promise<{ backdrops: any[]; posters: any[] }> => {
        const data = await fetchFromTMDB<{ backdrops: any[]; posters: any[] }>(`/movie/${id}/images`, {
            include_image_language: "en,null",
        }, signal);
        return data;
    },

    getPersonDetails: async (id: number, signal?: AbortSignal): Promise<any> => {
        return fetchFromTMDB<any>(`/person/${id}`, { append_to_response: "external_ids" }, signal);
    },

    getPersonCredits: async (id: number, signal?: AbortSignal): Promise<Movie[]> => {
        const data = await fetchFromTMDB<{ cast: Movie[] }>(`/person/${id}/movie_credits`, {}, signal);
        return data.cast.sort((a, b) => b.popularity - a.popularity).map(m => ({ ...m, media_type: "movie" }));
    },

    getMovieReviews: async (id: number, signal?: AbortSignal): Promise<any[]> => {
        const data = await fetchFromTMDB<{ results: any[] }>(`/movie/${id}/reviews`, {}, signal);
        return data.results || [];
    },

    getSimilar: async (id: number, signal?: AbortSignal): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>(`/movie/${id}/similar`, {}, signal);
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    }
};

export const tvService = {
    getTrending: async (signal?: AbortSignal): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/trending/tv/week", {}, signal);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getPopular: async (signal?: AbortSignal): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/tv/popular", {}, signal);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getTVDetails: async (id: number, signal?: AbortSignal): Promise<TVDetails> => {
        const data = await fetchFromTMDB<TVDetails>(`/tv/${id}`, {
            append_to_response: "credits,videos,external_ids,watch/providers",
        }, signal);
        const imdb_id = (data as any).external_ids?.imdb_id;
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return {
            ...data,
            cast,
            imdb_id,
            media_type: "tv",
            watch_providers: (data as any)["watch/providers"]
        };
    },

    searchTV: async (query: string, page: number = 1, signal?: AbortSignal): Promise<{
        results: TVSeries[];
        total_pages: number;
        total_results: number;
    }> => {
        if (!query) return { results: [], total_pages: 0, total_results: 0 };
        const data = await fetchFromTMDB<MovieResponse>("/search/tv", { query, page: page.toString() }, signal);
        return {
            results: (data.results || []).map(s => ({ ...s, media_type: "tv" as const })),
            total_pages: data.total_pages || 0,
            total_results: data.total_results || 0,
        };
    },

    getDiscover: async (filters: {
        with_genres?: string;
        with_keywords?: string;
        first_air_date_year?: string;
        "vote_average.gte"?: string;
        with_original_language?: string;
        sort_by?: string;
        region?: string;
        page?: string;
    }, signal?: AbortSignal): Promise<{ results: TVSeries[], total_pages: number, total_results: number }> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/tv", params, signal);
        return {
            results: (data.results || []).map(s => ({ ...s, media_type: "tv" as const })),
            total_pages: data.total_pages,
            total_results: data.total_results
        };
    },

    getSimilar: async (id: number, signal?: AbortSignal): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>(`/tv/${id}/similar`, {}, signal);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getTVReviews: async (id: number, signal?: AbortSignal): Promise<any[]> => {
        const data = await fetchFromTMDB<{ results: any[] }>(`/tv/${id}/reviews`, {}, signal);
        return data.results || [];
    }
};
