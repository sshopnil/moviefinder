
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleFavoriteActorAction } from "@/actions/favorite-actors";

interface FavoriteActorButtonProps {
    actor: {
        id: number;
        name: string;
        profile_path: string | null;
        known_for_department: string;
    };
    isFavoriteInitial: boolean;
}

export function FavoriteActorButton({ actor, isFavoriteInitial }: FavoriteActorButtonProps) {
    const [isFavorite, setIsFavorite] = useState(isFavoriteInitial);
    const [isLoading, setIsLoading] = useState(false);

    const handleToggle = async () => {
        if (isLoading) return;
        const previousState = isFavorite;
        setIsFavorite(!previousState);
        setIsLoading(true);

        try {
            const result = await toggleFavoriteActorAction(actor);
            setIsFavorite(result.isFavorite);
        } catch (error) {
            setIsFavorite(previousState);
            console.error("Failed to toggle favorite actor:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`p-3 rounded-full transition-all duration-300 group border ${isFavorite
                ? "bg-red-500/10 border-red-500/50 text-red-500"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
            title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        >
            <Heart
                className={`h-6 w-6 transition-transform ${isFavorite ? "fill-current scale-110" : "group-hover:scale-110"
                    }`}
            />
        </button>
    );
}
