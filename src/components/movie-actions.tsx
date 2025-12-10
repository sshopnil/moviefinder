"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { TrailerModal } from "@/components/trailer-modal";
import { WatchlistButton } from "@/components/watchlist-button";
import { MovieDetails } from "@/types/movie";

interface MovieActionsProps {
    movie: MovieDetails;
    isSaved: boolean;
}

export function MovieActions({ movie, isSaved }: MovieActionsProps) {
    const [showTrailer, setShowTrailer] = useState(false);

    // Safely extract trailer key
    const trailerKey = movie.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key;

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

                <WatchlistButton movie={movie} initialIsSaved={isSaved} />
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
