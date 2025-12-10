
"use server";

import { auth } from "@/auth";
import connectToDatabase from "@/lib/db";
import FavoriteActor from "@/models/FavoriteActor";
import { revalidatePath } from "next/cache";

interface ActorData {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string;
}

export async function toggleFavoriteActorAction(actor: ActorData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    await connectToDatabase();

    const existing = await FavoriteActor.findOne({
        userId: session.user.id,
        actorId: actor.id,
    });

    if (existing) {
        await FavoriteActor.findByIdAndDelete(existing._id);
        revalidatePath("/watchlist");
        revalidatePath(`/person/${actor.id}`);
        return { isFavorite: false };
    } else {
        await FavoriteActor.create({
            userId: session.user.id,
            actorId: actor.id,
            name: actor.name,
            profile_path: actor.profile_path,
            known_for_department: actor.known_for_department,
        });
        revalidatePath("/watchlist");
        revalidatePath(`/person/${actor.id}`);
        return { isFavorite: true };
    }
}

export async function getFavoriteActorsAction() {
    const session = await auth();
    if (!session?.user?.id) return [];

    await connectToDatabase();

    const favorites = await FavoriteActor.find({ userId: session.user.id }).sort({ createdAt: -1 });

    return favorites.map(f => ({
        id: f.actorId,
        name: f.name,
        profile_path: f.profile_path,
        known_for_department: f.known_for_department,
    }));
}

export async function getFavoriteActorStatusAction(actorId: number) {
    const session = await auth();
    if (!session?.user?.id) return false;

    await connectToDatabase();

    const existing = await FavoriteActor.findOne({
        userId: session.user.id,
        actorId: actorId,
    });

    return !!existing;
}
