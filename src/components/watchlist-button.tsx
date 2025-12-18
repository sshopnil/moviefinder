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
                title: movie.title || 'Unknown',
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date || '',
                genre_ids: movie.genre_ids || [],
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
                "flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all border-2 active:scale-[0.98] w-full sm:w-auto",
                optimisticSaved
                    ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-lg shadow-blue-900/20"
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
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
