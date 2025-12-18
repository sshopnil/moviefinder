// const TMDB_API_KEY = process.env.TMDB_API_KEY; // Moved inside function for runtime safety
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

import { Movie, MovieDetails, MovieResponse, TVSeries, TVDetails } from "@/types/movie";

export const TMDB_IMAGE_URL = {
    poster: (path: string | null) => path ? `${IMAGE_BASE_URL}/poster${path}` : "/placeholder-poster.png",
    backdrop: (path: string | null) => path ? `${IMAGE_BASE_URL}/backdrop${path}` : "/placeholder-backdrop.png",
    profile: (path: string | null) => path ? `${IMAGE_BASE_URL}/profile${path}` : "/placeholder-profile.png",
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

    searchMulti: async (query: string, page: number = 1): Promise<{
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
        }>("/search/multi", { query, page: page.toString() });

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
            append_to_response: "credits,videos,external_ids",
        });
        const imdb_id = (data as any).external_ids?.imdb_id || data.imdb_id;
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast, imdb_id, media_type: "movie" };
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
        page?: string;
    }): Promise<{ results: Movie[], total_pages: number, total_results: number }> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/movie", { ...params });

        return {
            results: (data.results || []).map(m => ({ ...m, media_type: "movie" as const })),
            total_pages: data.total_pages,
            total_results: data.total_results
        };
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
            append_to_response: "credits,videos,external_ids",
        });
        const imdb_id = (data as any).external_ids?.imdb_id;
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast, imdb_id, media_type: "tv" };
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
        page?: string;
    }): Promise<{ results: TVSeries[], total_pages: number, total_results: number }> => {
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        const data = await fetchFromTMDB<MovieResponse>("/discover/tv", params);
        return {
            results: (data.results || []).map(s => ({ ...s, media_type: "tv" as const })),
            total_pages: data.total_pages,
            total_results: data.total_results
        };
    },

    getSimilar: async (id: number): Promise<TVSeries[]> => {
        const data = await fetchFromTMDB<MovieResponse>(`/tv/${id}/similar`);
        return data.results.map(s => ({ ...s, media_type: "tv" }));
    }
};
