"use server";

import { auth } from "@/auth";
import connectToDatabase from "@/lib/db";
import Watchlist from "@/models/Watchlist";
import { revalidatePath } from "next/cache";

type WatchlistMediaType = "movie" | "tv";

type WatchlistInput = {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date?: string;
    genre_ids?: number[];
    media_type?: WatchlistMediaType;
};

function getMediaType(mediaType?: WatchlistMediaType): WatchlistMediaType {
    return mediaType === "tv" ? "tv" : "movie";
}

function getStoredMovieId(id: number, mediaType?: WatchlistMediaType) {
    return getMediaType(mediaType) === "tv" ? -Math.abs(id) : id;
}

function getPublicMovieId(storedMovieId: number, mediaType?: WatchlistMediaType) {
    return getMediaType(mediaType) === "tv" ? Math.abs(storedMovieId) : storedMovieId;
}

function getStatusQuery(userId: string, id: number, mediaType?: WatchlistMediaType) {
    const type = getMediaType(mediaType);
    const storedMovieId = getStoredMovieId(id, type);
    const legacyMovieId = type === "tv" ? id : undefined;

    return {
        userId,
        media_type: type,
        movieId: legacyMovieId ? { $in: [storedMovieId, legacyMovieId] } : storedMovieId,
    };
}

function revalidateMediaPaths(id: number, mediaType?: WatchlistMediaType) {
    const type = getMediaType(mediaType);
    revalidatePath("/watchlist");
    revalidatePath("/dashboard");
    revalidatePath(`/${type}/${id}`);
}

export async function toggleWatchlistAction(movie: WatchlistInput) {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in toggleWatchlistAction:", error);
        return { error: "Authentication failed" };
    }
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    await connectToDatabase();

    const mediaType = getMediaType(movie.media_type);
    const existing = await Watchlist.findOne(getStatusQuery(session.user.id, movie.id, mediaType));

    if (existing) {
        await Watchlist.findByIdAndDelete(existing._id);
        revalidateMediaPaths(movie.id, mediaType);
        return { added: false };
    } else {
        await Watchlist.create({
            userId: session.user.id,
            movieId: getStoredMovieId(movie.id, mediaType),
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date,
            genre_ids: movie.genre_ids,
            watched: false,
            media_type: mediaType,
        });
        revalidateMediaPaths(movie.id, mediaType);
        return { added: true };
    }
}

export async function toggleWatchedAction(movie: WatchlistInput) {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in toggleWatchedAction:", error);
        return { error: "Authentication failed" };
    }
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    await connectToDatabase();

    const mediaType = getMediaType(movie.media_type);
    const existing = await Watchlist.findOne(getStatusQuery(session.user.id, movie.id, mediaType));

    if (existing) {
        // Toggle watched status
        existing.watched = !existing.watched;
        await existing.save();
    } else {
        // Create new entry with watched = true
        await Watchlist.create({
            userId: session.user.id,
            movieId: getStoredMovieId(movie.id, mediaType),
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date,
            genre_ids: movie.genre_ids,
            watched: true,
            media_type: mediaType,
        });
    }

    revalidateMediaPaths(movie.id, mediaType);

    // Return the new state
    return { watched: existing ? existing.watched : true };
}

export async function getWatchlistStatusAction(movieId: number, mediaType: WatchlistMediaType = "movie") {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getWatchlistStatusAction:", error);
        return { isSaved: false, isWatched: false };
    }
    if (!session?.user?.id) return { isSaved: false, isWatched: false };

    await connectToDatabase();
    const existing = await Watchlist.findOne(getStatusQuery(session.user.id, movieId, mediaType));

    return {
        isSaved: !!existing,
        isWatched: existing ? !!existing.watched : false
    };
}

// Simplified for client-side filtering
export async function getWatchlistAction() {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getWatchlistAction:", error);
        return [];
    }
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const watchlist = await Watchlist.find({ userId: session.user.id }).sort({ createdAt: -1 });

    return watchlist.map(item => {
        const isTV = item.media_type === "tv";
        return {
            id: getPublicMovieId(item.movieId, item.media_type),
            title: !isTV ? item.title : undefined,
            name: isTV ? item.title : undefined, // Map title to name for TV
            media_type: item.media_type || "movie",
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            release_date: !isTV ? item.release_date : undefined,
            first_air_date: isTV ? item.release_date : undefined, // Map release_date to first_air_date for TV
            genre_ids: item.genre_ids || [],
            adult: false,
            backdrop_path: "",
            original_language: "en",
            original_title: item.title,
            overview: "",
            popularity: 0,
            video: false,
            vote_count: 0,
            watched: item.watched || false
        };
    });
}


export async function getWatchedIdsAction() {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getWatchedIdsAction:", error);
        return [];
    }
    if (!session?.user?.id) return [];

    await connectToDatabase();

    // Fetch only fields needed for watched keys
    const watchedItems = await Watchlist.find(
        { userId: session.user.id, watched: true },
        { movieId: 1, media_type: 1 }
    );

    return watchedItems.map(item => `${item.media_type || "movie"}:${getPublicMovieId(item.movieId, item.media_type)}`);
}
export async function getUserWatchlistAction() {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getUserWatchlistAction:", error);
        return [];
    }
    if (!session?.user?.id) return [];

    await connectToDatabase();
    // Sort by most recently added
    const watchlist = await Watchlist.find({ userId: session.user.id }).sort({ createdAt: -1 });

    // Transform to Movie-like shape if needed, strictly speaking the schema matches close enough for display
    // Transform to Movie-like shape if needed, strictly speaking the schema matches close enough for display
    return watchlist.map(item => {
        const isTV = item.media_type === "tv";
        return {
            id: getPublicMovieId(item.movieId, item.media_type),
            title: !isTV ? item.title : undefined,
            name: isTV ? item.title : undefined,
            media_type: item.media_type || "movie",
            poster_path: item.poster_path,
            vote_average: item.vote_average,
            release_date: !isTV ? item.release_date : undefined,
            first_air_date: isTV ? item.release_date : undefined,
            // Add fake fields to match Movie interface if strictly required by TS components
            adult: false,
            backdrop_path: "",
            genre_ids: [],
            original_language: "en",
            original_title: item.title,
            overview: "",
            popularity: 0,
            video: false,
            vote_count: 0
        };
    });
}

export async function getWatchlistGenresAction() {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getWatchlistGenresAction:", error);
        return [];
    }
    if (!session?.user?.id) return [];

    await connectToDatabase();

    // distinct genres returns an array of numbers
    const genreIds = await Watchlist.distinct("genre_ids", { userId: session.user.id });

    // Import here to avoid circular dependencies if any
    const { MOVIE_GENRES } = await import("@/lib/genres");

    const availableGenres = MOVIE_GENRES.filter(g => genreIds.includes(g.id));

    return availableGenres;
}
