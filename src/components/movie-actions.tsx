"use client";

import { Play, Check, Eye } from "lucide-react";
import { useState, useTransition } from "react";
import { TrailerModal } from "@/components/trailer-modal";
import { WatchlistButton } from "@/components/watchlist-button";
import { MovieDetails } from "@/types/movie";
import { useRouter } from "next/navigation";
import { toggleWatchedAction } from "@/actions/watchlist";

interface MovieActionsProps {
    movie: MovieDetails;
    isSaved: boolean;
    isWatched: boolean;
}

export function MovieActions({ movie, isSaved, isWatched }: MovieActionsProps) {
    const [showTrailer, setShowTrailer] = useState(false);
    const isTV = 'name' in movie;
    const title = isTV ? (movie as any).name : (movie as any).title;
    const releaseDate = isTV ? (movie as any).first_air_date : (movie as any).release_date;

    const trailerKey = movie.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key;

    const movieWithUnifiedFields = {
        ...movie,
        title: title || 'Unknown',
        release_date: releaseDate || '',
        genre_ids: movie.genre_ids || (movie as any).genres?.map((g: any) => g.id) || [],
    };

    return (
        <>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:gap-4 pt-4">
                {trailerKey && (
                    <button
                        onClick={() => setShowTrailer(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all active:scale-[0.98] w-full sm:w-auto"
                    >
                        <Play className="h-4 w-4 fill-current" />
                        Watch Trailer
                    </button>
                )}

                <WatchlistButton movie={movieWithUnifiedFields as any} initialIsSaved={isSaved} />

                <WatchedButton movie={movieWithUnifiedFields as any} initialIsWatched={isWatched} />
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

function WatchedButton({ movie, initialIsWatched }: { movie: any, initialIsWatched: boolean }) {
    const [isWatched, setIsWatched] = useState(initialIsWatched);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleToggle = async () => {
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
                    setIsWatched(result.watched);
                } else {
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
            className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all border-2 active:scale-[0.98] w-full sm:w-auto ${isWatched
                ? "bg-green-600 border-green-600 text-white hover:bg-green-700 hover:border-green-700 shadow-lg shadow-green-900/20"
                : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                }`}
        >
            {isWatched ? <Check className="h-4 w-4 stroke-[3px]" /> : <Eye className="h-4 w-4" />}
            {isWatched ? "Watched" : "Mark Watched"}
        </button>
    );
}
