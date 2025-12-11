"use client";

import { createContext, useContext, useState, useOptimistic, useTransition, ReactNode } from "react";
import { toggleWatchedAction } from "@/actions/watchlist";
import { Movie } from "@/types/movie";

interface WatchedContextType {
    isWatched: (id: number) => boolean;
    toggleWatched: (movie: Movie) => Promise<void>;
}

const WatchedContext = createContext<WatchedContextType | null>(null);

export function useWatched() {
    const context = useContext(WatchedContext);
    if (!context) {
        throw new Error("useWatched must be used within a WatchedProvider");
    }
    return context;
}

interface WatchedProviderProps {
    children: ReactNode;
    initialWatchedIds: number[];
}

export function WatchedProvider({ children, initialWatchedIds }: WatchedProviderProps) {
    // Keep track of IDs locally
    const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set(initialWatchedIds));
    const [isPending, startTransition] = useTransition();

    // Optimistic UI updates
    const [optimisticWatchedIds, setOptimisticWatchedIds] = useOptimistic(
        watchedIds,
        (currentIds, updatedId: number) => {
            const newIds = new Set(currentIds);
            if (newIds.has(updatedId)) {
                newIds.delete(updatedId);
            } else {
                newIds.add(updatedId);
            }
            return newIds;
        }
    );

    const isWatched = (id: number) => optimisticWatchedIds.has(id);

    const toggleWatched = async (movie: Movie) => {
        const id = movie.id;

        startTransition(async () => {
            // Optimistic update
            setOptimisticWatchedIds(id);

            try {
                // Call server
                const result = await toggleWatchedAction({
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average,
                    release_date: movie.release_date,
                    genre_ids: movie.genre_ids || [],
                });

                if (result?.watched !== undefined) {
                    setWatchedIds(prev => {
                        const next = new Set(prev);
                        if (result.watched) next.add(id);
                        else next.delete(id);
                        return next;
                    });
                } else {
                    // Revert handled by optimistic automatically if we don't update state
                    console.error("Failed to update status");
                }
            } catch (error) {
                console.error(error);
            }
        });
    };

    return (
        <WatchedContext.Provider value={{ isWatched, toggleWatched }}>
            {children}
        </WatchedContext.Provider>
    );
}
