"use client";

import { Play, Plus, Check } from "lucide-react";
import { useState } from "react";
import { TrailerModal } from "@/components/trailer-modal";
import { cn } from "@/lib/utils";

interface MovieActionsProps {
    trailerKey?: string;
}

export function MovieActions({ trailerKey }: MovieActionsProps) {
    const [showTrailer, setShowTrailer] = useState(false);

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

                {/* Watchlist button will go here later */}
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
