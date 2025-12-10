"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toggleWatchlistAction } from "@/actions/watchlist";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Movie } from "@/types/movie";

interface WatchlistButtonProps {
    movie: Movie;
    initialIsSaved: boolean;
}

export function WatchlistButton({ movie, initialIsSaved }: WatchlistButtonProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [optimisticSaved, addOptimisticSaved] = useOptimistic(
        initialIsSaved,
        (state, newStatus: boolean) => newStatus
    );

    const handleToggle = async () => {
        if (!session) {
            router.push("/login?callbackUrl=" + window.location.pathname);
            return;
        }

        startTransition(async () => {
            // Optimistically toggle
            addOptimisticSaved(!optimisticSaved);

            // Call server action
            const result = await toggleWatchlistAction({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date,
                genre_ids: movie.genre_ids,
            });

            if (result.error) {
                // Revert on error (not handled simply here but you'd normally show toast)
                // Since we rely on optimistic update mostly, the UI might flip back if revalidation happens
                // or we need manual revert logic. For now, simple optimistic is fine.
                console.error("Failed to toggle watchlist", result.error);
            }
        });
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl border transition-colors",
                optimisticSaved
                    ? "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20"
                    : "bg-white/10 border-white/10 text-white hover:bg-white/20"
            )}
        >
            {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Heart className={cn("h-4 w-4", optimisticSaved && "fill-current")} />
            )}
            {optimisticSaved ? "Saved" : "Watchlist"}
        </button>
    );
}
