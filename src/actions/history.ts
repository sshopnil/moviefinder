
"use server";

import { auth } from "@/auth";
import connectToDatabase from "@/lib/db";
import SearchHistory from "@/models/SearchHistory";
import RecentlyViewed from "@/models/RecentlyViewed";
import { revalidatePath } from "next/cache";

export async function logSearchAction(query: string) {
    const session = await auth();
    if (!session?.user?.id) return;
    if (!query.trim()) return;

    await connectToDatabase();

    // Deduplicate: If same query was searched recently, just update timestamp? 
    // For simplicity, just create new entry or update if recent. 
    // Let's just create new one for now, or update if very recent?
    // Let's just insert. A robust system might upsert today's searches.

    // Check if the query exists for user to update timestamp instead of spamming DB with same query
    const existing = await SearchHistory.findOne({ userId: session.user.id, query: query });
    if (existing) {
        existing.touch(); // Update updatedAt
        await existing.save();
    } else {
        await SearchHistory.create({
            userId: session.user.id,
            query: query
        });
    }
}

export async function logViewAction(item: {
    id: number,
    type: 'movie' | 'person' | 'tv',
    title: string,
    poster_path: string | null
}) {
    const session = await auth();
    if (!session?.user?.id) return;

    await connectToDatabase();

    await RecentlyViewed.findOneAndUpdate(
        {
            userId: session.user.id,
            itemId: item.id,
            itemType: item.type
        },
        {
            title: item.title,
            poster_path: item.poster_path, // Update image in case it changed or was added
            $set: { updatedAt: new Date() } // Force update timestamp
        },
        { upsert: true, new: true }
    );
}

export async function getRecentSearchesAction(limit = 10) {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const history = await SearchHistory.find({ userId: session.user.id })
        .sort({ updatedAt: -1 }) // Most recent updated (searched)
        .limit(limit);

    return history.map(h => ({ query: h.query, date: h.updatedAt }));
}

export async function getRecentlyViewedAction(limit = 10) {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const history = await RecentlyViewed.find({ userId: session.user.id })
        .sort({ updatedAt: -1 })
        .limit(limit);

    // Normalize for MovieBrowser/PersonBrowser if possible
    return history.map(h => ({
        id: h.itemId,
        title: h.title, // name or title
        name: h.title || 'Unknown', // Alias for PersonCard
        poster_path: h.poster_path,
        profile_path: h.poster_path || null, // Alias for PersonCard
        media_type: h.itemType, // 'movie' or 'person'
        // Mock timestamps or minimal fields
        release_date: '',
        vote_average: 0
    }));
}
