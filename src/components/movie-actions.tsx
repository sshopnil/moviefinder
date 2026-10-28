"use client";

import { Play, Check, Eye, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { TrailerModal } from "@/components/trailer-modal";
import { WatchlistButton } from "@/components/watchlist-button";
import { MovieDetails } from "@/types/movie";
import { useRouter } from "next/navigation";
import { toggleWatchedAction } from "@/actions/watchlist";
import { useSession } from "next-auth/react";

interface MovieActionsProps {
    movie: MovieDetails;
    isSaved: boolean;
    isWatched: boolean;
}

export function MovieActions({ movie, isSaved, isWatched }: MovieActionsProps) {
    const { status } = useSession();
    const [showTrailer, setShowTrailer] = useState(false);
    const [saved, setSaved] = useState(isSaved);
    const [watched, setWatched] = useState(isWatched);
    const isTV = 'name' in movie;
    const title = isTV ? (movie as any).name : (movie as any).title;
    const releaseDate = isTV ? (movie as any).first_air_date : (movie as any).release_date;

    useEffect(() => {
        if (status !== "authenticated") return;
        let isMounted = true;

        async function fetchStatus() {
            try {
                const { getWatchlistStatusAction } = await import("@/actions/watchlist");
                const res = await getWatchlistStatusAction(movie.id, isTV ? "tv" : "movie");
                if (isMounted && res) {
                    setSaved(res.isSaved);
                    setWatched(res.isWatched);
                }
            } catch (err) {
                console.error("Failed to fetch watchlist status:", err);
            }
        }

        fetchStatus();
        return () => { isMounted = false; };
    }, [movie.id, isTV, status]);

    const trailerKey = movie.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key;

    const movieWithUnifiedFields = {
        ...movie,
        title: title || 'Unknown',
        release_date: releaseDate || '',
        genre_ids: movie.genre_ids || (movie as any).genres?.map((g: any) => g.id) || [],
        media_type: isTV ? 'tv' as const : 'movie' as const,
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

                <WatchlistButton movie={movieWithUnifiedFields as any} initialIsSaved={saved} />

                <WatchedButton movie={movieWithUnifiedFields as any} initialIsWatched={watched} />
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
    const { data: session, status } = useSession();
    const [isWatched, setIsWatched] = useState(initialIsWatched);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsWatched(initialIsWatched);
    }, [initialIsWatched]);

    const handleToggle = async () => {
        if (status === "loading" || isLoading) return;

        if (!session) {
            router.push("/login?callbackUrl=" + window.location.pathname);
            return;
        }

        const previousState = isWatched;
        const newState = !previousState;
        setIsWatched(newState);
        setIsLoading(true);

        try {
            const result = await toggleWatchedAction({
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date,
                genre_ids: movie.genre_ids || [],
                media_type: movie.media_type,
            });

            if (result?.watched !== undefined) {
                setIsWatched(result.watched);
            } else {
                setIsWatched(previousState);
            }
        } catch (error) {
            console.error("Failed to toggle watched:", error);
            setIsWatched(previousState);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading || status === "loading"}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all border-2 active:scale-[0.98] w-full sm:w-auto ${isWatched
                ? "bg-green-600 border-green-600 text-white hover:bg-green-700 hover:border-green-700 shadow-lg shadow-green-900/20"
                : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                }`}
        >
            {isLoading || status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isWatched ? (
                <Check className="h-4 w-4 stroke-[3px]" />
            ) : (
                <Eye className="h-4 w-4" />
            )}
            {!session ? "Sign in to mark watched" : isWatched ? "Watched" : "Mark Watched"}
        </button>
    );
}
