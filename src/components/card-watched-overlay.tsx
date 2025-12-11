"use client";

import { useWatched } from "@/components/watched-context";
import { Movie } from "@/types/movie";
import { Eye, Loader2 } from "lucide-react";
import { useTransition } from "react";

interface CardWatchedOverlayProps {
    movie: Movie;
}

export function CardWatchedOverlay({ movie }: CardWatchedOverlayProps) {
    const { isWatched, toggleWatched } = useWatched();
    const watched = isWatched(movie.id);
    const [isPending, startTransition] = useTransition();

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation
        e.stopPropagation();

        startTransition(() => {
            toggleWatched(movie);
        });
    };

    return (
        <>
            {watched && (
                <div className="absolute top-2 right-2 z-10 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none">
                    WATCHED
                </div>
            )}

            <button
                onClick={handleToggle}
                disabled={isPending}
                className="absolute top-2 left-2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title={watched ? "Mark as unwatched" : "Mark as watched"}
            >
                {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Eye className={`h-4 w-4 ${watched ? "text-green-400 fill-current" : "text-white"}`} />
                )}
            </button>
        </>
    );
}
