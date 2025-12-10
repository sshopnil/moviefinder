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

        // Fetch up to 20 pages (approx 400 results) to provide a "limitless" feel
        // We fetch in batches to avoid overwhelming the API
        const maxPages = 20;
        const batchSize = 5;
        let allResults: any[] = [];

        // Fetch page 1 first to check total pages? 
        // For simplicity/speed, we'll just fire the batches. 
        // A more robust way: Fetch P1, get total_pages, then fetch rest.

        // Let's just blindly fetch 1-20 for now, relying on empty results for out-of-bounds pages.
        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        // Process in chunks
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

        // Deduplicate by ID
        const seen = new Set();
        const uniqueResults = allResults.filter(item => {
            const duplicate = seen.has(item.id);
            seen.add(item.id);
            return !duplicate;
        });

        const movies = uniqueResults.filter((item: any) => item.media_type === "movie") as Movie[];
        const people = uniqueResults.filter((item: any) => item.media_type === "person");

        return { movies, people };
    },

    searchMovies: async (query: string): Promise<Movie[]> => {
        if (!query) return [];
        const data = await fetchFromTMDB<MovieResponse>("/search/movie", { query });
        return data.results;
    },

    searchPeople: async (query: string): Promise<any[]> => {
        if (!query) return [];

        // Fetch up to 5 pages (100 people)
        const maxPages = 5;
        const pages = Array.from({ length: maxPages }, (_, i) => i + 1);

        const promises = pages.map(page =>
            fetchFromTMDB<{ results: any[] }>("/search/person", { query, page: page.toString() })
                .catch(() => ({ results: [] }))
        );

        const results = await Promise.all(promises);
        const allPeople = results.flatMap(r => r.results || []);

        // Deduplicate
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
        // Transform credits to simpler cast array
        const cast = (data as any).credits?.cast?.slice(0, 10) || [];
        return { ...data, cast };
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
    }): Promise<Movie[]> => {
        // Remove undefined keys
        const params = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v != null && v !== "")
        ) as Record<string, string>;

        // Fetch up to 20 pages
        const maxPages = 20;
        const batchSize = 5;
        let allMovies: Movie[] = [];

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

        // Deduplicate
        const seen = new Set();
        const uniqueMovies = allMovies.filter(m => {
            const duplicate = seen.has(m.id);
            seen.add(m.id);
            return !duplicate;
        });

        return uniqueMovies;
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
        return data.cast.sort((a, b) => b.popularity - a.popularity);
    }
};
