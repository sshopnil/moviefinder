"use client";

import { createContext, useContext, useState, useOptimistic, useTransition, ReactNode, useEffect } from "react";
import { toggleWatchedAction } from "@/actions/watchlist";
import { Movie } from "@/types/movie";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface WatchedContextType {
    isWatched: (movie: WatchedMovie) => boolean;
    toggleWatched: (movie: WatchedMovie) => Promise<void>;
}

type WatchedMovie = Movie & { name?: string };

function getWatchedKey(movieOrId: WatchedMovie | number) {
    if (typeof movieOrId === "number") return `movie:${movieOrId}`;

    const mediaType = movieOrId.media_type === "tv" ? "tv" : "movie";
    return `${mediaType}:${movieOrId.id}`;
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
    initialWatchedIds?: string[];
}

export function WatchedProvider({ children, initialWatchedIds = [] }: WatchedProviderProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    // Keep track of IDs locally
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set(initialWatchedIds));
    const [, startTransition] = useTransition();

    useEffect(() => {
        if (status !== "authenticated") return;

        const fetchWatched = async () => {
            try {
                const { getWatchedIdsAction } = await import("@/actions/watchlist");
                const ids = await getWatchedIdsAction();
                setWatchedIds(new Set(ids));
            } catch (error) {
                console.error("Failed to fetch watched IDs", error);
            }
        };

        fetchWatched();
    }, [status]);

    // Optimistic UI updates
    const [optimisticWatchedIds, setOptimisticWatchedIds] = useOptimistic(
        watchedIds,
        (currentIds, updatedKey: string) => {
            const newIds = new Set(currentIds);
            if (newIds.has(updatedKey)) {
                newIds.delete(updatedKey);
            } else {
                newIds.add(updatedKey);
            }
            return newIds;
        }
    );

    const isWatched = (movie: WatchedMovie) => optimisticWatchedIds.has(getWatchedKey(movie));

    const toggleWatched = async (movie: WatchedMovie) => {
        if (!session) {
            router.push("/login?callbackUrl=" + window.location.pathname);
            return;
        }

        const key = getWatchedKey(movie);
        const mediaType = movie.media_type === "tv" ? "tv" : "movie";

        startTransition(async () => {
            // Optimistic update
            setOptimisticWatchedIds(key);

            try {
                // Call server
                const result = await toggleWatchedAction({
                    id: movie.id,
                    title: movie.title || movie.name || "Unknown",
                    poster_path: movie.poster_path,
                    vote_average: movie.vote_average,
                    release_date: movie.release_date || "",
                    genre_ids: movie.genre_ids || [],
                    media_type: mediaType,
                });

                if (result?.watched !== undefined) {
                    setWatchedIds(prev => {
                        const next = new Set(prev);
                        if (result.watched) next.add(key);
                        else next.delete(key);
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
