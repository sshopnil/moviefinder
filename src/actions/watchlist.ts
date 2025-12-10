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
    release_date: string;
}) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    await connectToDatabase();

    const existing = await Watchlist.findOne({
        userId: session.user.id,
        movieId: movie.id,
    });

    if (existing) {
        await Watchlist.findByIdAndDelete(existing._id);
        revalidatePath("/dashboard");
        revalidatePath(`/movie/${movie.id}`);
        return { added: false };
    } else {
        await Watchlist.create({
            userId: session.user.id,
            movieId: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            release_date: movie.release_date,
        });
        revalidatePath("/dashboard");
        revalidatePath(`/movie/${movie.id}`);
        return { added: true };
    }
}

export async function getWatchlistStatusAction(movieId: number) {
    const session = await auth();
    if (!session?.user?.id) return false;

    await connectToDatabase();
    const existing = await Watchlist.findOne({
        userId: session.user.id,
        movieId,
    });

    return !!existing;
}

export async function getUserWatchlistAction() {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();
    // Sort by most recently added
    const watchlist = await Watchlist.find({ userId: session.user.id }).sort({ createdAt: -1 });

    // Transform to Movie-like shape if needed, strictly speaking the schema matches close enough for display
    return watchlist.map(item => ({
        id: item.movieId,
        title: item.title,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: item.release_date,
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
    }));
}
