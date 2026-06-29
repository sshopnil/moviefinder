"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toggleWatchlistAction } from "@/actions/watchlist";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Movie } from "@/types/movie";

type WatchlistButtonMovie = Movie & {
    name?: string;
    media_type?: "movie" | "tv" | "person";
};

interface WatchlistButtonProps {
    movie: WatchlistButtonMovie;
    initialIsSaved: boolean;
}

export function WatchlistButton({ movie, initialIsSaved }: WatchlistButtonProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isSaved, setIsSaved] = useState(initialIsSaved);

    useEffect(() => {
        setIsSaved(initialIsSaved);
    }, [initialIsSaved]);

    const handleToggle = async () => {
        if (status === "loading") return;

        if (!session) {
            router.push("/login?callbackUrl=" + window.location.pathname);
            return;
        }

        const previousState = isSaved;
        setIsSaved(!previousState);

        startTransition(async () => {
            try {
                const mediaType = movie.media_type === "tv" ? "tv" : "movie";
                const result = await toggleWatchlistAction({
                    id: movie.id,
                    title: movie.title || movie.name || "Unknown",
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average,
                    release_date: movie.release_date || "",
                    genre_ids: movie.genre_ids || [],
                    media_type: mediaType,
                });

                if (result.error) {
                    setIsSaved(previousState);
                    console.error("Failed to toggle watchlist", result.error);
                    return;
                }

                if (result.added !== undefined) {
                    setIsSaved(result.added);
                }

                router.refresh();
            } catch (error) {
                setIsSaved(previousState);
                console.error("Failed to toggle watchlist", error);
            }
        });
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending || status === "loading"}
            className={cn(
                "flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all border-2 active:scale-[0.98] w-full sm:w-auto",
                isSaved
                    ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-lg shadow-blue-900/20"
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
            )}
        >
            {isPending || status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
            )}
            {!session ? "Sign in to save" : isSaved ? "Saved" : "Watchlist"}
        </button>
    );
}
