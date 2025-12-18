export type MediaType = "movie" | "tv" | "person";

export interface Movie {
    id: number;
    title: string;
    original_title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    vote_average: number;
    genre_ids?: number[];
    original_language?: string;
    popularity: number;
    watched?: boolean;
    media_type?: MediaType;
}

export interface TVSeries {
    id: number;
    name: string;
    original_name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date: string;
    vote_average: number;
    genre_ids?: number[];
    original_language?: string;
    popularity: number;
    watched?: boolean;
    media_type?: MediaType;
}

export interface MovieDetails extends Movie {
    genres: Genre[];
    runtime: number;
    tagline: string;
    cast: Cast[];
    videos: { results: Video[] };
}

export interface TVDetails extends TVSeries {
    genres: Genre[];
    episode_run_time: number[];
    number_of_episodes: number;
    number_of_seasons: number;
    tagline: string;
    cast: Cast[];
    videos: { results: Video[] };
    seasons: Season[];
}

export interface Season {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    episode_count: number;
    air_date: string;
}

export interface Genre {
    id: number;
    name: string;
}

export interface Cast {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
}

export interface Video {
    id: string;
    key: string;
    name: string;
    site: string;
    type: string;
}

export interface MovieResponse {
    page: number;
    results: (Movie & TVSeries)[];
    total_pages: number;
    total_results: number;
}
