// const TMDB_API_KEY = process.env.TMDB_API_KEY; // Moved inside function for runtime safety
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

import { Movie, MovieDetails, MovieResponse, TVSeries, TVDetails } from "@/types/movie";

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
        include_adult: "false",
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
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    },

    getPopular: async (): Promise<Movie[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/movie/popular");
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    },

    searchMulti: async (query: string): Promise<{ movies: Movie[], tv: TVSeries[], people: any[] }> => {
        if (!query) return { movies: [], tv: [], people: [] };

        const maxPages = 5; // Reduced from 20 for faster initial search, can be increased if needed
        const batchSize = 5;
        const allResults: any[] = [];

        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        for (let i = 0; i < pages.length; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            const promises = batch.map(page =>
                fetchFromTMDB<{ results: any[] }>("/search/multi", { query, page: page.toString() })
                    .catch(() => ({ results: [] }))
            );
            const batchResults = await Promise.all(promises);
            batchResults.forEach(r => {
                if (r.results) allResults.push(...r.results);
            });
        }

        const seen = new Set();
        const uniqueResults = allResults.filter(item => {
            const duplicate = seen.has(item.id);
            seen.add(item.id);
            return !duplicate;
        });

        const movies = uniqueResults.filter((item: any) => item.media_type === "movie") as Movie[];
        const tv = uniqueResults.filter((item: any) => item.media_type === "tv") as TVSeries[];
        const people = uniqueResults.filter((item: any) => item.media_type === "person");

        return { movies, tv, people };
    },

    searchMovies: async (query: string): Promise<Movie[]> => {
        if (!query) return [];
        const data = await fetchFromTMDB<MovieResponse>("/search/movie", { query });
        return data.results.map(m => ({ ...m, media_type: "movie" }));
    },

    searchPeople: async (query: string): Promise<any[]> => {
        if (!query) return [];

        const maxPages = 3;
        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        const promises = pages.map(page =>
            fetchFromTMDB<{ results: any[] }>("/search/person", { query, page: page.toString() })
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

    getMovieDetails: async (id: number): Promise<MovieDetails> => {
        const data = await fetchFromTMDB<MovieDetails>(`/movie/${id}`, {
            append_to_response: "credits,videos",
        });
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast, media_type: "movie" };
    },

    getDiscover: async (filters: {
        with_genres?: string;
        primary_release_year?: string;
        "vote_average.gte"?: string;
        "vote_count.gte"?: string;
        with_runtime_gte?: string;
        with_runtime_lte?: string;
        with_original_language?: string;
        region?: string;
        sort_by?: string;
    }): Promise<Movie[]> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const maxPages = 5;
        const batchSize = 5;
        const allMovies: Movie[] = [];

        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        for (let i = 0; i < pages.length; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            const promises = batch.map(page =>
                fetchFromTMDB<MovieResponse>("/discover/movie", { ...params, page: page.toString() })
                    .catch(() => ({ results: [] } as any))
            );
            const batchResults = await Promise.all(promises);
            batchResults.forEach(r => {
                if (r.results) allMovies.push(...r.results);
            });
        }

        const seen = new Set();
        const uniqueMovies = allMovies.filter(m => {
            const duplicate = seen.has(m.id);
            seen.add(m.id);
            return !duplicate;
        });

        return uniqueMovies.map(m => ({ ...m, media_type: "movie" }));
    },

    getMovieImages: async (id: number): Promise<{ backdrops: any[]; posters: any[] }> => {
        const data = await fetchFromTMDB<{ backdrops: any[]; posters: any[] }>(`/movie/${id}/images`, {
            include_image_language: "en,null",
        });
        return data;
    },

    getPersonDetails: async (id: number): Promise<any> => {
        return fetchFromTMDB<any>(`/person/${id}`, { append_to_response: "external_ids" });
    },

    getPersonCredits: async (id: number): Promise<Movie[]> => {
        const data = await fetchFromTMDB<{ cast: Movie[] }>(`/person/${id}/movie_credits`);
        return data.cast.sort((a, b) => b.popularity - a.popularity).map(m => ({ ...m, media_type: "movie" }));
    },

    getMovieReviews: async (id: number): Promise<any[]> => {
        const data = await fetchFromTMDB<{ results: any[] }>(`/movie/${id}/reviews`);
        return data.results || [];
    }
};

export const tvService = {
    getTrending: async (): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/trending/tv/week");
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getPopular: async (): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>("/tv/popular");
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getTVDetails: async (id: number): Promise<TVDetails> => {
        const data = await fetchFromTMDB<TVDetails>(`/tv/${id}`, {
            append_to_response: "credits,videos",
        });
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast, media_type: "tv" };
    },

    searchTV: async (query: string): Promise<TVSeries[]> => {
        if (!query) return [];
        const data = await fetchFromTMDB<MovieResponse>("/search/tv", { query });
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getDiscover: async (filters: {
        with_genres?: string;
        first_air_date_year?: string;
        "vote_average.gte"?: string;
        with_original_language?: string;
        sort_by?: string;
        region?: string;
    }): Promise<TVSeries[]> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/tv", params);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    },

    getSimilar: async (id: number): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>(`/tv/${id}/similar`);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    }
};
