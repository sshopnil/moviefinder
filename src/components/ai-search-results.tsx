"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MovieGrid } from "@/components/movie-grid";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";
import { AIRecommendation, Movie, TVSeries } from "@/types/movie";

interface AISearchResultsProps {
    mood: string;
    type?: string;
    with_genres?: string;
    page?: number;
}

type ResultItem = (Movie | TVSeries) & { aiMeta?: AIRecommendation };
type StreamState = {
    items: ResultItem[];
    status: "streaming" | "done" | "error";
    error?: string;
};

const resultCache = new Map<string, StreamState>();
const streamRequests = new Set<string>();
const streamListeners = new Map<string, Set<() => void>>();

const MAX_CACHE_ENTRIES = 25;

function getStreamState(key: string) {
    let state = resultCache.get(key);
    if (!state) {
        if (resultCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = resultCache.keys().next().value;
            if (oldestKey) resultCache.delete(oldestKey);
        }
        state = { items: [], status: "streaming" };
        resultCache.set(key, state);
    }
    return state;
}

function updateStreamState(key: string, update: (state: StreamState) => StreamState) {
    resultCache.set(key, update(getStreamState(key)));
    streamListeners.get(key)?.forEach((listener) => listener());
}

function subscribeToStream(key: string, listener: () => void) {
    const listeners = streamListeners.get(key) || new Set();
    listeners.add(listener);
    streamListeners.set(key, listeners);

    return () => {
        listeners.delete(listener);
    };
}

function getPreviouslyShownTitles(mood: string, page: number) {
    const titles: string[] = [];

    resultCache.forEach((state, key) => {
        try {
            const cachedQuery = JSON.parse(key) as AISearchResultsProps;
            if (cachedQuery.mood !== mood || (cachedQuery.page || 1) >= page) return;

            state.items.forEach((item) => {
                titles.push("name" in item ? item.name : item.title);
            });
        } catch {
            // Ignore unrelated cache entries.
        }
    });

    return Array.from(new Set(titles));
}

async function readRecommendationStream(key: string, body: AISearchResultsProps & { excludeTitles?: string[]; refresh?: boolean }, signal?: AbortSignal) {
    const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok || !response.body) throw new Error("Failed to start recommendation stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);

            if (event.type === "item") {
                updateStreamState(key, (state) => ({ ...state, items: [...state.items, event.item] }));
            } else if (event.type === "rateLimit") {
                showAIRateLimitToast(event.rateLimit);
                updateStreamState(key, (state) => ({
                    ...state,
                    error: "AI request limit reached. Please try again shortly.",
                }));
            } else if (event.type === "error") {
                updateStreamState(key, (state) => ({ ...state, error: event.message }));
            }
        }

        if (done) break;
    }

    updateStreamState(key, (state) => ({ ...state, status: state.error ? "error" : "done" }));
}

function ensureRecommendationStream(key: string, body: AISearchResultsProps, refresh = false, signal?: AbortSignal) {
    if (streamRequests.has(key) || getStreamState(key).status !== "streaming") return;
    streamRequests.add(key);

    void readRecommendationStream(key, {
        ...body,
        excludeTitles: getPreviouslyShownTitles(body.mood, body.page || 1),
        refresh,
    }, signal).catch((error) => {
        if (signal?.aborted || (error as Error)?.name === "AbortError") {
            return;
        }
        console.error("AI Search Process failed", error);
        updateStreamState(key, (state) => ({
            ...state,
            error: "Failed to get recommendations. Please try again.",
            status: "error",
        }));
    }).finally(() => {
        streamRequests.delete(key);
    });
}

export function AISearchResults({ mood, type, with_genres, page = 1 }: AISearchResultsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const cacheKey = JSON.stringify({ mood, type, with_genres, page });
    const abortControllerRef = useRef<AbortController | null>(null);
    const state = useSyncExternalStore(
        (listener) => subscribeToStream(cacheKey, listener),
        () => getStreamState(cacheKey),
        () => getStreamState(cacheKey),
    );

    useEffect(() => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        ensureRecommendationStream(cacheKey, { mood, type, with_genres, page }, false, controller.signal);
        return () => {
            controller.abort();
        };
    }, [cacheKey, mood, page, type, with_genres]);

    const navigateToPage = (nextPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextPage === 1) params.delete("page");
        else params.set("page", nextPage.toString());
        router.push(`/?${params.toString()}`, { scroll: false });
    };

    const regeneratePage = () => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        streamRequests.delete(cacheKey);
        updateStreamState(cacheKey, () => ({ items: [], status: "streaming" }));
        ensureRecommendationStream(cacheKey, { mood, type, with_genres, page }, true, controller.signal);
    };

    return (
        <section aria-live="polite" aria-busy={state.status === "streaming"}>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-white/90">
                    AI Recommendations for &quot;{mood}&quot; <span className="text-base font-normal text-gray-500">Page {page}</span>
                </h2>
                {state.status === "streaming" && <span className="text-sm text-purple-300">Results appear as they are found</span>}
            </div>

            {(state.items.length > 0 || state.status === "streaming") && (
                <MovieGrid
                    movies={state.items}
                    title=""
                    pendingCount={state.status === "streaming" ? Math.max(0, 6 - state.items.length) : 0}
                />
            )}

            {state.status === "error" && state.items.length === 0 && (
                <div className="py-20 text-center text-red-400">{state.error}</div>
            )}

            {state.status === "done" && state.items.length === 0 && (
                <div className="py-20 text-center text-gray-500">
                    No results found for your mood. Try describing it differently.
                </div>
            )}

            {(state.items.length >= 6 || (state.status !== "streaming" && state.items.length > 0)) && (
                <nav className="mt-10 flex items-center justify-center gap-4 border-t border-white/10 pt-6" aria-label="AI recommendation pages">
                    <button
                        type="button"
                        onClick={() => navigateToPage(page - 1)}
                        disabled={page === 1}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </button>
                    <span className="text-sm text-gray-400">Page <span className="font-semibold text-white">{page}</span></span>
                    {state.status !== "streaming" && (
                        <button
                            type="button"
                            onClick={regeneratePage}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Regenerate
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => navigateToPage(page + 1)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </nav>
            )}
        </section>
    );
}
