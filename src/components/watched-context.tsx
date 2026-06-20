"use client";

import { createContext, useContext, useState, useOptimistic, useTransition, ReactNode, useEffect } from "react";
import { toggleWatchedAction } from "@/actions/watchlist";
import { Movie } from "@/types/movie";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    initialWatchedIds?: number[];
}

export function WatchedProvider({ children, initialWatchedIds = [] }: WatchedProviderProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    // Keep track of IDs locally
    const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set(initialWatchedIds));
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (status !== "authenticated") return;

        const fetchWatched = async () => {
            try {
                const { getWatchedIdsAction } = await import("@/actions/watchlist");
                const ids = await getWatchedIdsAction();
                if (ids && ids.length > 0) {
                    setWatchedIds(new Set(ids));
                }
            } catch (error) {
                console.error("Failed to fetch watched IDs", error);
            }
        };

        fetchWatched();
    }, [status]);

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
        if (!session) {
            router.push("/login?callbackUrl=" + window.location.pathname);
            return;
        }

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
                    release_date: movie.release_date || "",
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
