"use server";

import { auth } from "@/auth";
import connectToDatabase from "@/lib/db";
import Watchlist from "@/models/Watchlist";
import { revalidatePath } from "next/cache";

export async function toggleWatchlistAction(movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date?: string;
    genre_ids?: number[];
    media_type?: "movie" | "tv";
}) {
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

    const existing = await Watchlist.findOne({
        userId: session.user.id,
        movieId: movie.id,
    });

    if (existing) {
        if (existing.watched) {
            // If it was watched, we might want to just unwatch it? Or remove it entirely?
            // Standard behavior for "watchlist" toggle usually removes it.
            // But if we have a separate "watched" toggle, we need to decide.
            // Let's keep this as "toggle watchlist" (add/remove from list).
            // If removing, it deletes the record, so watched status is lost.
            await Watchlist.findByIdAndDelete(existing._id);
            revalidatePath("/watchlist");
            revalidatePath("/dashboard");
            revalidatePath(`/movie/${movie.id}`);
            return { added: false };
        } else {
            await Watchlist.findByIdAndDelete(existing._id);
            revalidatePath("/watchlist");
            revalidatePath("/dashboard");
            revalidatePath(`/movie/${movie.id}`);
            return { added: false };
        }
    } else {
        await Watchlist.create({
            userId: session.user.id,
            movieId: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date,
            genre_ids: movie.genre_ids,
            watched: false,
            media_type: movie.media_type || "movie", // Default to movie if not provided
        });
        revalidatePath("/watchlist");
        revalidatePath("/dashboard");
        revalidatePath(`/movie/${movie.id}`);
        return { added: true };
    }
}

export async function toggleWatchedAction(movie: {
    id: number;
    title: string;
    poster_path: string | null;
    vote_average: number;
    release_date?: string;
    genre_ids?: number[];
    media_type?: "movie" | "tv";
}) {
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

    const existing = await Watchlist.findOne({
        userId: session.user.id,
        movieId: movie.id,
    });

    if (existing) {
        // Toggle watched status
        existing.watched = !existing.watched;
        await existing.save();
    } else {
        // Create new entry with watched = true
        await Watchlist.create({
            userId: session.user.id,
            movieId: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date,
            genre_ids: movie.genre_ids,
            watched: true,
            media_type: movie.media_type || "movie",
        });
    }

    revalidatePath("/watchlist");
    revalidatePath("/dashboard");
    revalidatePath(`/movie/${movie.id}`);

    // Return the new state
    return { watched: existing ? existing.watched : true };
}

export async function getWatchlistStatusAction(movieId: number) {
    let session;
    try {
        session = await auth();
    } catch (error) {
        console.error("Auth error in getWatchlistStatusAction:", error);
        return { isSaved: false, isWatched: false };
    }
    if (!session?.user?.id) return { isSaved: false, isWatched: false };

    await connectToDatabase();
    const existing = await Watchlist.findOne({
        userId: session.user.id,
        movieId,
    });

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
            id: item.movieId,
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

    // Fetch only movieId field for watched items
    const watchedItems = await Watchlist.find(
        { userId: session.user.id, watched: true },
        { movieId: 1 }
    );

    return watchedItems.map(item => item.movieId);
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
            id: item.movieId,
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
