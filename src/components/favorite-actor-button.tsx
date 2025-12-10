
"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavoriteActorAction } from "@/actions/favorite-actors";
import { useRouter } from "next/navigation";

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
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleToggle = async () => {
        // Optimistic update
        setIsFavorite(!isFavorite);

        startTransition(async () => {
            try {
                const result = await toggleFavoriteActorAction(actor);
                setIsFavorite(result.isFavorite);
                router.refresh();
            } catch (error) {
                // Revert on error
                setIsFavorite(!isFavorite);
                console.error("Failed to toggle favorite actor:", error);
            }
        });
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPending}
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
