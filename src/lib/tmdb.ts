// const TMDB_API_KEY = process.env.TMDB_API_KEY; // Moved inside function for runtime safety
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

import type { Movie, MovieDetails, MovieResponse, TVSeries, TVDetails, Cast, CrewMember } from "../types/movie.ts";

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

        const firstPage = await fetchFromTMDB<{ results: any[]; total_pages: number }>(
            "/search/person",
            { query, page: "1" },
            signal
        ).catch(() => ({ results: [], total_pages: 0 }));

        const totalPages = Math.min(3, firstPage.total_pages || 1);
        let subsequentResults: any[] = [];

        if (totalPages > 1) {
            const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            const subsequent = await Promise.all(
                pages.map(page =>
                    fetchFromTMDB<{ results: any[] }>("/search/person", { query, page: page.toString() }, signal)
                        .catch(() => ({ results: [] }))
                )
            );
            subsequentResults = subsequent.flatMap(r => r.results || []);
        }

        const allPeople = [...(firstPage.results || []), ...subsequentResults];
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
        const rawCast = (data as any).credits?.cast || [];
        const rawCrew = (data as any).credits?.crew || [];
        const cast = normalizeMovieCast(rawCast);
        const crew = normalizeMovieCrew(rawCrew);
        return {
            ...data,
            cast,
            crew,
            imdb_id,
            media_type: "movie",
            watch_providers: (data as any)["watch/providers"]
        };
    },

    getMovieCredits: async (id: number, signal?: AbortSignal): Promise<{ cast: Cast[]; crew: CrewMember[] }> => {
        if (!Number.isFinite(id)) return { cast: [], crew: [] };
        try {
            const data = await fetchFromTMDB<{ id: number; cast: any[]; crew: any[] }>(
                `/movie/${id}/credits`,
                {},
                signal
            );
            return {
                cast: normalizeMovieCast(data?.cast || []),
                crew: normalizeMovieCrew(data?.crew || []),
            };
        } catch (error) {
            if (!(error instanceof TMDBError && error.status === 404)) {
                console.error(`Error fetching credits for movie ${id}:`, error);
            }
            return { cast: [], crew: [] };
        }
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
        const cast = data.cast || [];
        const seen = new Set<number>();
        const uniqueMovies: Movie[] = [];
        const sorted = cast.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        for (const m of sorted) {
            if (m && m.id && !seen.has(m.id)) {
                seen.add(m.id);
                uniqueMovies.push({ ...m, media_type: "movie" });
            }
        }
        return uniqueMovies;
    },

    getPersonCombinedCredits: async (id: number, signal?: AbortSignal): Promise<(Movie | TVSeries)[]> => {
        const data = await fetchFromTMDB<{ cast: any[] }>(`/person/${id}/combined_credits`, {}, signal);
        const cast = data.cast || [];
        const seen = new Set<string>();
        const uniqueCredits: (Movie | TVSeries)[] = [];

        const sorted = cast
            .filter((item: any) => item && item.id && (item.title || item.name))
            .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        for (const item of sorted) {
            const isTV = item.media_type === "tv" || Boolean(item.first_air_date && !item.release_date);
            const mediaType = isTV ? ("tv" as const) : ("movie" as const);
            const key = `${mediaType}:${item.id}`;

            if (!seen.has(key)) {
                seen.add(key);
                uniqueCredits.push({
                    ...item,
                    media_type: mediaType,
                });
            }
        }

        return uniqueCredits;
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

export function splitCharacters(charStr?: string | null): string[] {
    if (!charStr || typeof charStr !== "string") return [];
    return charStr
        .split(/\s*(?:\/|\|)\s*/)
        .map(s => s.trim())
        .filter(Boolean);
}

export function getCrewJobPriority(job?: string, department?: string): number {
    const j = (job || "").trim().toLowerCase();
    const d = (department || "").trim().toLowerCase();

    // 1. Director & Co-Director
    if (j === "director" || j === "co-director") return 1;

    // 2. Writing / Screenplay
    if (
        j === "screenplay" ||
        j === "writer" ||
        j === "written by" ||
        j === "story" ||
        j === "screen story" ||
        j.includes("screenplay") ||
        (d === "writing" && (j.includes("writer") || j.includes("story") || j.includes("author")))
    ) return 2;

    // 3. Main Producers
    if (j === "producer" || j === "executive producer" || j === "co-producer") return 3;

    // 4. Cinematography / DP
    if (j === "director of photography" || j === "cinematographer" || j.includes("director of photography")) return 4;

    // 5. Film Editing
    if (j === "editor" || j === "film editor" || j.includes("film editor") || (d === "editing" && j === "editor")) return 5;

    // 6. Original Music Composer
    if (
        j === "original music composer" ||
        j === "composer" ||
        j === "music" ||
        j.includes("original music composer") ||
        (d === "sound" && (j.includes("composer") || j === "original music"))
    ) return 6;

    // 7. Production Design & Art Direction
    if (j === "production design" || j === "production designer" || j === "art direction" || j === "supervising art director") return 7;

    // 8. Costume Design & Makeup Head
    if (j === "costume design" || j === "costume designer" || j === "makeup department head" || j === "hair department head") return 8;

    // 9. Visual Effects Supervisor & Sound Supervisor
    if (
        j === "visual effects supervisor" ||
        j === "vfx supervisor" ||
        j === "sound designer" ||
        j === "supervising sound editor" ||
        j === "casting" ||
        j === "casting director"
    ) return 9;

    // 10. Key directing/writing/producing supervisors & assistants
    if (d === "directing" && (j.includes("director") || j === "script supervisor")) return 10;
    if (d === "writing") return 10;
    if (d === "production" && (j.includes("producer") || j.includes("manager") || j.includes("supervisor"))) return 10;

    // 11. Other departmental creative roles
    if (d === "sound" || d === "camera" || d === "editing" || d === "art" || d === "visual effects" || d === "costume & make-up") return 11;

    // 12. General crew, assistants, coordinators, runners, drivers
    return 12;
}

export function normalizeMovieCast(rawCast: any[]): Cast[] {
    if (!Array.isArray(rawCast)) return [];

    const actorMap = new Map<number, Cast>();

    for (const c of rawCast) {
        if (!c || typeof c.id !== "number" || !Number.isFinite(c.id)) continue;
        const name = typeof c.name === "string" ? c.name.trim() : "";
        if (!name) continue;

        // Extract characters from roles array if available, or fallback to character string
        const extractedCharacters: string[] = [];
        if (Array.isArray(c.roles) && c.roles.length > 0) {
            for (const r of c.roles) {
                const parts = splitCharacters(r?.character);
                for (const p of parts) {
                    if (!extractedCharacters.includes(p)) extractedCharacters.push(p);
                }
            }
        } else if (typeof c.character === "string") {
            const parts = splitCharacters(c.character);
            for (const p of parts) {
                if (!extractedCharacters.includes(p)) extractedCharacters.push(p);
            }
        }

        const existing = actorMap.get(c.id);
        if (existing) {
            // Merge characters (avoiding duplicates)
            const existingChars = splitCharacters(existing.character);
            for (const charName of extractedCharacters) {
                if (!existingChars.includes(charName)) {
                    existingChars.push(charName);
                }
            }
            existing.character = existingChars.join(" / ");

            // Keep lowest billing order
            if (typeof c.order === "number") {
                existing.order = existing.order !== undefined ? Math.min(existing.order, c.order) : c.order;
            }

            // Populate profile_path if previously missing
            if (!existing.profile_path && c.profile_path) {
                existing.profile_path = c.profile_path;
            }
        } else {
            actorMap.set(c.id, {
                id: c.id,
                name,
                character: extractedCharacters.join(" / "),
                profile_path: c.profile_path || null,
                order: typeof c.order === "number" ? c.order : undefined,
            });
        }
    }

    return Array.from(actorMap.values()).sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 9999;
        const orderB = typeof b.order === "number" ? b.order : 9999;
        return orderA - orderB;
    });
}

export function normalizeMovieCrew(rawCrew: any[]): CrewMember[] {
    if (!Array.isArray(rawCrew)) return [];

    const crewMap = new Map<number, {
        id: number;
        name: string;
        profile_path: string | null;
        jobs: Array<{ job: string; priority: number; department: string }>;
    }>();

    for (const c of rawCrew) {
        if (!c || typeof c.id !== "number" || !Number.isFinite(c.id)) continue;
        const name = typeof c.name === "string" ? c.name.trim() : "";
        if (!name) continue;

        const job = typeof c.job === "string" ? c.job.trim() : "";
        const department = typeof c.department === "string" ? c.department.trim() : "";
        const priority = getCrewJobPriority(job, department);

        const existing = crewMap.get(c.id);
        if (existing) {
            if (job && !existing.jobs.some(j => j.job.toLowerCase() === job.toLowerCase())) {
                existing.jobs.push({ job, priority, department });
            }
            if (!existing.profile_path && c.profile_path) {
                existing.profile_path = c.profile_path;
            }
        } else {
            crewMap.set(c.id, {
                id: c.id,
                name,
                profile_path: c.profile_path || null,
                jobs: job ? [{ job, priority, department }] : [],
            });
        }
    }

    return Array.from(crewMap.values())
        .map(entry => {
            // Sort jobs by priority ascending so most prestigious title is first
            entry.jobs.sort((a, b) => a.priority - b.priority);
            const bestJob = entry.jobs[0] || { job: "", priority: 12, department: "" };
            // Pick up to 3 primary jobs to avoid overflowing cards
            const formattedJob = entry.jobs.slice(0, 3).map(j => j.job).join(" / ");
            return {
                id: entry.id,
                name: entry.name,
                job: formattedJob || bestJob.job,
                department: bestJob.department,
                profile_path: entry.profile_path,
                priority: bestJob.priority,
            };
        })
        .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.name.localeCompare(b.name);
        });
}

export function normalizeTVCast(rawCast: any[]): Cast[] {
    if (!Array.isArray(rawCast)) return [];

    const actorMap = new Map<number, Cast>();

    for (const c of rawCast) {
        if (!c || typeof c.id !== "number" || !Number.isFinite(c.id)) continue;
        const name = typeof c.name === "string" ? c.name.trim() : "";
        if (!name) continue;

        // Extract characters from roles array if available, or fallback to character string
        const extractedCharacters: string[] = [];
        if (Array.isArray(c.roles) && c.roles.length > 0) {
            for (const r of c.roles) {
                const parts = splitCharacters(r?.character);
                for (const p of parts) {
                    if (!extractedCharacters.includes(p)) extractedCharacters.push(p);
                }
            }
        } else if (typeof c.character === "string") {
            const parts = splitCharacters(c.character);
            for (const p of parts) {
                if (!extractedCharacters.includes(p)) extractedCharacters.push(p);
            }
        }

        // Calculate total episode count
        let episodeCount: number | undefined = typeof c.total_episode_count === "number" ? c.total_episode_count : undefined;
        if (episodeCount === undefined && Array.isArray(c.roles) && c.roles.length > 0) {
            episodeCount = c.roles.reduce((acc: number, r: any) => acc + (typeof r?.episode_count === "number" ? r.episode_count : 0), 0);
        }

        const existing = actorMap.get(c.id);
        if (existing) {
            // Merge characters (avoiding duplicates)
            const existingChars = splitCharacters(existing.character);
            let hasNewCharacters = false;
            for (const charName of extractedCharacters) {
                if (!existingChars.includes(charName)) {
                    existingChars.push(charName);
                    hasNewCharacters = true;
                }
            }
            existing.character = existingChars.join(" / ");

            // Merge episode counts: if this entry contains new characters, add episode count; otherwise keep max
            if (typeof episodeCount === "number") {
                if (hasNewCharacters) {
                    existing.total_episode_count = (existing.total_episode_count || 0) + episodeCount;
                } else {
                    existing.total_episode_count = Math.max(existing.total_episode_count || 0, episodeCount);
                }
            }

            // Keep lowest order (billing order)
            if (typeof c.order === "number") {
                existing.order = existing.order !== undefined ? Math.min(existing.order, c.order) : c.order;
            }

            // Populate profile_path if previously missing
            if (!existing.profile_path && c.profile_path) {
                existing.profile_path = c.profile_path;
            }
        } else {
            actorMap.set(c.id, {
                id: c.id,
                name,
                character: extractedCharacters.join(" / "),
                profile_path: c.profile_path || null,
                total_episode_count: episodeCount,
                order: typeof c.order === "number" ? c.order : undefined,
            });
        }
    }

    return Array.from(actorMap.values()).sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 9999;
        const orderB = typeof b.order === "number" ? b.order : 9999;
        return orderA - orderB;
    });
}

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
            append_to_response: "aggregate_credits,credits,videos,external_ids,watch/providers",
        }, signal);
        const imdb_id = (data as any).external_ids?.imdb_id;

        // Prioritize aggregate_credits to return the complete cast across all seasons and episodes,
        // falling back to credits if aggregate_credits is empty or unavailable
        const aggregateCast = (data as any).aggregate_credits?.cast;
        const fallbackCast = (data as any).credits?.cast || [];
        const cast = Array.isArray(aggregateCast) && aggregateCast.length > 0
            ? normalizeTVCast(aggregateCast)
            : normalizeTVCast(fallbackCast);

        return {
            ...data,
            cast,
            imdb_id,
            media_type: "tv",
            watch_providers: (data as any)["watch/providers"]
        };
    },

    getTVSeasonCredits: async (tvId: number, seasonNumber: number, signal?: AbortSignal): Promise<Cast[]> => {
        if (!Number.isFinite(tvId) || !Number.isFinite(seasonNumber)) return [];
        try {
            // First attempt aggregate_credits for the season to fetch all episodic and recurring cast members
            try {
                const aggData = await fetchFromTMDB<{ id: number; cast: any[] }>(
                    `/tv/${tvId}/season/${seasonNumber}/aggregate_credits`,
                    {},
                    signal
                );
                if (aggData?.cast && Array.isArray(aggData.cast) && aggData.cast.length > 0) {
                    return normalizeTVCast(aggData.cast);
                }
            } catch {
                // If aggregate_credits is unavailable or fails, fall back to standard credits
            }

            const data = await fetchFromTMDB<{ id: number; cast: any[] }>(
                `/tv/${tvId}/season/${seasonNumber}/credits`,
                {},
                signal
            );
            return normalizeTVCast(data.cast || []);
        } catch (error) {
            // Suppress expected 404 logging for missing or unreleased seasons
            if (!(error instanceof TMDBError && error.status === 404)) {
                console.error(`Error fetching season ${seasonNumber} credits for TV ${tvId}:`, error);
            }
            return [];
        }
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
