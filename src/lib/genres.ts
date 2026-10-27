export const MOVIE_GENRES = [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 36, name: "History" },
    { id: 27, name: "Horror" },
    { id: 10402, name: "Music" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Science Fiction" },
    { id: 10770, name: "TV Movie" },
    { id: 53, name: "Thriller" },
    { id: 10752, name: "War" },
    { id: 37, name: "Western" },
];

export const TV_GENRES = [
    { id: 10759, name: "Action & Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 10762, name: "Kids" },
    { id: 9648, name: "Mystery" },
    { id: 10763, name: "News" },
    { id: 10764, name: "Reality" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
    { id: 10766, name: "Soap" },
    { id: 10767, name: "Talk" },
    { id: 10768, name: "War & Politics" },
    { id: 37, name: "Western" },
];

// Mapping between TMDB Movie and TV genre equivalents
const MOVIE_TO_TV_GENRE_MAP: Record<number, number> = {
    28: 10759,   // Action -> Action & Adventure
    12: 10759,   // Adventure -> Action & Adventure
    878: 10765,  // Sci-Fi -> Sci-Fi & Fantasy
    14: 10765,   // Fantasy -> Sci-Fi & Fantasy
    10752: 10768 // War -> War & Politics
};

const TV_TO_MOVIE_GENRE_MAP: Record<number, number[]> = {
    10759: [28, 12],   // Action & Adventure -> Action, Adventure
    10765: [878, 14],  // Sci-Fi & Fantasy -> Sci-Fi, Fantasy
    10768: [10752],    // War & Politics -> War
};

export const getGenreName = (id: number): string => {
    return MOVIE_GENRES.find(g => g.id === id)?.name
        || TV_GENRES.find(g => g.id === id)?.name
        || "Unknown";
};

export function getCompatibleGenreIds(genreId: number, mediaType: "movie" | "tv"): number[] {
    if (mediaType === "tv") {
        const tvEquiv = MOVIE_TO_TV_GENRE_MAP[genreId];
        return tvEquiv ? [genreId, tvEquiv] : [genreId];
    } else {
        const movieEquivs = TV_TO_MOVIE_GENRE_MAP[genreId];
        return movieEquivs ? [genreId, ...movieEquivs] : [genreId];
    }
}

export function matchesGenreFilter(
    genreIds: number[] | undefined,
    filterGenreId: number | string,
    mediaType: "movie" | "tv"
): boolean {
    if (!genreIds || genreIds.length === 0) return false;
    const numFilterId = typeof filterGenreId === "string" ? parseInt(filterGenreId, 10) : filterGenreId;
    if (isNaN(numFilterId)) return false;

    const compatibleIds = getCompatibleGenreIds(numFilterId, mediaType);
    return compatibleIds.some(id => genreIds.includes(id));
}

export function getGenreIdForDiscover(
    filterGenreId: string | number,
    mediaType: "movie" | "tv"
): string {
    const numId = typeof filterGenreId === "string" ? parseInt(filterGenreId, 10) : filterGenreId;
    if (isNaN(numId)) return String(filterGenreId);

    if (mediaType === "tv") {
        const tvId = MOVIE_TO_TV_GENRE_MAP[numId];
        return tvId ? String(tvId) : String(numId);
    }
    return String(numId);
}
