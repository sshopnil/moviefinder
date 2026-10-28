
"use server";

import { auth } from "@/auth";
import connectToDatabase from "@/lib/db";
import SearchHistory from "@/models/SearchHistory";
import RecentlyViewed from "@/models/RecentlyViewed";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SearchQuerySchema = z.string().trim().min(1).max(200);

export async function logSearchAction(rawQuery: string) {
    const session = await auth();
    if (!session?.user?.id) return;
    const parsed = SearchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) return;

    await connectToDatabase();

    await SearchHistory.findOneAndUpdate(
        { userId: session.user.id, query: parsed.data },
        { $set: { updatedAt: new Date() } },
        { upsert: true }
    );
}

export const addSearchHistory = logSearchAction;

export async function logViewAction(item: {
    id: number,
    type: 'movie' | 'person' | 'tv',
    title: string,
    poster_path: string | null,
    season?: number,
    episode?: number,
    progress?: number,
    duration?: number,
    revalidate?: boolean
}) {
    const session = await auth();
    if (!session?.user?.id) return;

    await connectToDatabase();

    const setFields: Record<string, unknown> = {
        title: item.title,
        poster_path: item.poster_path,
        season: item.season,
        episode: item.episode,
        updatedAt: new Date()
    };

    if (item.progress !== undefined) setFields.progress = item.progress;
    if (item.duration !== undefined) setFields.duration = item.duration;

    await RecentlyViewed.findOneAndUpdate(
        {
            userId: session.user.id,
            itemId: item.id,
            itemType: item.type
        },
        { $set: setFields },
        { upsert: true, new: true }
    );

    const shouldRevalidate = item.revalidate ?? (item.progress === undefined || item.progress === 0);
    if (shouldRevalidate) {
        revalidatePath("/dashboard");
        revalidatePath("/history");
    }
}

export async function removeFromHistoryAction(itemId: number, itemType: string) {
    const session = await auth();
    if (!session?.user?.id) return;
    await connectToDatabase();
    await RecentlyViewed.deleteOne({ userId: session.user.id, itemId, itemType });
    revalidatePath("/dashboard");
    revalidatePath("/history");
}

export async function clearHistoryAction() {
    const session = await auth();
    if (!session?.user?.id) return;
    await connectToDatabase();
    await RecentlyViewed.deleteMany({ userId: session.user.id });
    revalidatePath("/dashboard");
    revalidatePath("/history");
}

export async function getRecentSearchesAction(limit = 10) {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const history = await SearchHistory.find({ userId: session.user.id })
        .sort({ updatedAt: -1 }) // Most recent updated (searched)
        .limit(limit)
        .lean();

    return history.map(h => ({ query: h.query, date: h.updatedAt }));
}

export async function getRecentlyViewedAction(limit = 10) {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const history = await RecentlyViewed.find({ userId: session.user.id })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

    // Normalize for MovieBrowser/PersonBrowser if possible
    return history.map(h => ({
        id: h.itemId,
        title: h.title, // name or title
        name: h.title || 'Unknown', // Alias for PersonCard
        poster_path: h.poster_path,
        profile_path: h.poster_path || null, // Alias for PersonCard
        media_type: h.itemType, // 'movie' or 'person'
        season: h.season,
        episode: h.episode,
        progress: h.progress,
        duration: h.duration,
        updatedAt: h.updatedAt,
        // Mock timestamps or minimal fields
        release_date: '',
        vote_average: 0
    }));
}
