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
    genre_ids: number[];
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
        revalidatePath("/watchlist");
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
            genre_ids: movie.genre_ids,
        });
        revalidatePath("/watchlist");
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

export async function getWatchlistAction(params?: {
    query?: string;
    sortBy?: string;
    genreId?: string;
}) {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const filter: any = { userId: session.user.id };

    if (params?.query) {
        filter.title = { $regex: params.query, $options: "i" };
    }

    if (params?.genreId && params.genreId !== "all") {
        filter.genre_ids = parseInt(params.genreId);
    }

    let sort: any = { createdAt: -1 }; // Default: Date Added (Newest)

    if (params?.sortBy) {
        switch (params.sortBy) {
            case "date_asc":
                sort = { createdAt: 1 };
                break;
            case "release_desc":
                sort = { release_date: -1 };
                break;
            case "release_asc":
                sort = { release_date: 1 };
                break;
            case "rating_desc":
                sort = { vote_average: -1 };
                break;
            case "rating_asc":
                sort = { vote_average: 1 };
                break;
            default:
                sort = { createdAt: -1 };
        }
    }

    const watchlist = await Watchlist.find(filter).sort(sort);

    return watchlist.map(item => ({
        id: item.movieId,
        title: item.title,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: item.release_date,
        genre_ids: item.genre_ids || [],
        adult: false,
        backdrop_path: "",
        original_language: "en",
        original_title: item.title,
        overview: "",
        popularity: 0,
        video: false,
        vote_count: 0
    }));
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

export async function getWatchlistGenresAction() {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    // distinct genres returns an array of numbers
    const genreIds = await Watchlist.distinct("genre_ids", { userId: session.user.id });

    // Import here to avoid circular dependencies if any
    const { MOVIE_GENRES } = await import("@/lib/genres");

    const availableGenres = MOVIE_GENRES.filter(g => genreIds.includes(g.id));

    return availableGenres;
}
