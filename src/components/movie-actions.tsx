"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { TrailerModal } from "@/components/trailer-modal";
import { WatchlistButton } from "@/components/watchlist-button";
import { MovieDetails } from "@/types/movie";

interface MovieActionsProps {
    movie: MovieDetails;
    isSaved: boolean;
    isWatched: boolean;
}

export function MovieActions({ movie, isSaved, isWatched }: MovieActionsProps) {
    const [showTrailer, setShowTrailer] = useState(false);

    // Safely extract trailer key
    const trailerKey = movie.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key;

    // Ensure genre_ids are present (TMDB Details API returns genres array, not genre_ids)
    const movieWithGenreIds = {
        ...movie,
        genre_ids: movie.genre_ids || movie.genres?.map((g) => g.id) || [],
    };

    return (
        <>
            <div className="flex flex-wrap gap-4 pt-4">
                {trailerKey && (
                    <button
                        onClick={() => setShowTrailer(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                    >
                        <Play className="h-4 w-4 fill-current" />
                        Watch Trailer
                    </button>
                )}

                <WatchlistButton movie={movieWithGenreIds} initialIsSaved={isSaved} />

                <WatchedButton movie={movieWithGenreIds} initialIsWatched={isWatched} />
            </div>

            {trailerKey && showTrailer && (
                <TrailerModal
                    videoId={trailerKey}
                    onClose={() => setShowTrailer(false)}
                />
            )}
        </>
    );
}

import { Check, Eye } from "lucide-react";
import { toggleWatchedAction } from "@/actions/watchlist";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

function WatchedButton({ movie, initialIsWatched }: { movie: MovieDetails, initialIsWatched: boolean }) {
    const [isWatched, setIsWatched] = useState(initialIsWatched);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleToggle = async () => {
        // Optimistic update
        const newState = !isWatched;
        setIsWatched(newState);

        startTransition(async () => {
            try {
                const result = await toggleWatchedAction({
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average,
                    release_date: movie.release_date,
                    genre_ids: movie.genre_ids || [],
                });

                if (result?.watched !== undefined) {
                    // Sync with server state
                    setIsWatched(result.watched);
                } else {
                    // Revert
                    setIsWatched(!newState);
                }
                router.refresh();
            } catch (error) {
                console.error(error);
                setIsWatched(!newState);
            }
        });
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all border-2 ${isWatched
                ? "bg-green-600 border-green-600 text-white hover:bg-green-700 hover:border-green-700"
                : "bg-transparent border-white/20 text-white hover:bg-white/10"
                }`}
        >
            {isWatched ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isWatched ? "Watched" : "Mark Watched"}
        </button>
    );
}
