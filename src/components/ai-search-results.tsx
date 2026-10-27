"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MovieGrid } from "@/components/movie-grid";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";
import { AIRecommendation, AIRateLimitInfo, Movie, TVSeries } from "@/types/movie";

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
    isSemantic?: boolean;
    rateLimit?: AIRateLimitInfo;
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
        if (listeners.size === 0) {
            streamListeners.delete(key);
        }
    };
}

function getPreviouslyShownTitles(mood: string, page: number) {
    const titles: string[] = [];

    resultCache.forEach((state, key) => {
        // Never include semantic fallback titles in AI exclusion list
        if (state.isSemantic || state.items.some((i) => i.aiMeta?.source === "fallback" || i.aiMeta?.source === "rate_limited")) {
            return;
        }

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
            const trimmed = line.trim();
            if (!trimmed) continue;
            let event;
            try {
                event = JSON.parse(trimmed);
            } catch (err) {
                console.warn("[AISearch] Failed to parse stream event:", trimmed, err);
                continue;
            }

            if (event.type === "item" && event.item) {
                const isItemFallback = event.item.aiMeta?.source === "fallback" || event.item.aiMeta?.source === "rate_limited";
                const itemRateLimit = event.item.aiMeta?.rateLimit;
                updateStreamState(key, (state) => {
                    const itemKey = `${event.item.media_type || "movie"}-${event.item.id}`;
                    if (state.items.some((i) => `${i.media_type || "movie"}-${i.id}` === itemKey)) {
                        return {
                            ...state,
                            isSemantic: state.isSemantic || isItemFallback,
                            rateLimit: itemRateLimit || state.rateLimit,
                        };
                    }
                    return {
                        ...state,
                        items: [...state.items, event.item],
                        isSemantic: state.isSemantic || isItemFallback,
                        rateLimit: itemRateLimit || state.rateLimit,
                    };
                });
            } else if (event.type === "quota") {
                updateStreamState(key, (state) => ({
                    ...state,
                    isSemantic: true,
                    rateLimit: event.rateLimit || state.rateLimit,
                }));
            } else if (event.type === "rateLimit") {
                showAIRateLimitToast(event.rateLimit);
                updateStreamState(key, (state) => ({
                    ...state,
                    isSemantic: true,
                    rateLimit: event.rateLimit || state.rateLimit,
                    error: "AI request limit reached. Showing instant semantic results.",
                }));
            } else if (event.type === "error") {
                updateStreamState(key, (state) => ({ ...state, error: event.message }));
            }
        }

        if (done) break;
    }

    if (buffer.trim()) {
        try {
            const event = JSON.parse(buffer.trim());
            if (event.type === "item" && event.item) {
                const isItemFallback = event.item.aiMeta?.source === "fallback" || event.item.aiMeta?.source === "rate_limited";
                const itemRateLimit = event.item.aiMeta?.rateLimit;
                updateStreamState(key, (state) => {
                    const itemKey = `${event.item.media_type || "movie"}-${event.item.id}`;
                    if (state.items.some((i) => `${i.media_type || "movie"}-${i.id}` === itemKey)) {
                        return {
                            ...state,
                            isSemantic: state.isSemantic || isItemFallback,
                            rateLimit: itemRateLimit || state.rateLimit,
                        };
                    }
                    return {
                        ...state,
                        items: [...state.items, event.item],
                        isSemantic: state.isSemantic || isItemFallback,
                        rateLimit: itemRateLimit || state.rateLimit,
                    };
                });
            } else if (event.type === "quota" || event.type === "rateLimit") {
                updateStreamState(key, (state) => ({
                    ...state,
                    isSemantic: true,
                    rateLimit: event.rateLimit || state.rateLimit,
                }));
            }
        } catch {
            // Trailing malformed buffer ignored
        }
    }

    updateStreamState(key, (state) => {
        const isSemantic = state.isSemantic || state.items.some((i) => i.aiMeta?.source === "fallback" || i.aiMeta?.source === "rate_limited");
        return {
            ...state,
            isSemantic,
            status: state.error && state.items.length === 0 ? "error" : "done",
        };
    });
}

function ensureRecommendationStream(key: string, body: AISearchResultsProps, refresh = false, signal?: AbortSignal) {
    const currentState = resultCache.get(key);
    if (streamRequests.has(key)) return;

    // Semantic results must NEVER be served from cache: if previous stream was semantic, clear and re-run
    if (!refresh && currentState && currentState.status === "done") {
        const isSemantic = currentState.isSemantic || currentState.items.some((i) => i.aiMeta?.source === "fallback" || i.aiMeta?.source === "rate_limited");
        if (isSemantic) {
            resultCache.delete(key);
        } else {
            return;
        }
    } else if (currentState?.status !== "streaming" && !refresh) {
        if (currentState?.isSemantic) {
            resultCache.delete(key);
        }
    }

    if (getStreamState(key).status !== "streaming") return;
    streamRequests.add(key);

    void readRecommendationStream(key, {
        ...body,
        excludeTitles: getPreviouslyShownTitles(body.mood, body.page || 1),
        refresh,
    }, signal).catch((error) => {
        if (signal?.aborted || (error as Error)?.name === "AbortError") {
            const current = resultCache.get(key);
            if (current && current.items.length === 0) {
                resultCache.delete(key);
            } else if (current) {
                updateStreamState(key, (state) => ({ ...state, status: "done" }));
            }
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

    const isSemantic = Boolean(
        state.isSemantic ||
        (state.items.length > 0 && state.items.some((i) => i.aiMeta?.source === "fallback" || i.aiMeta?.source === "rate_limited"))
    );

    const resetAt = state.rateLimit?.resetAt;

    const [secondsLeft, setSecondsLeft] = useState<number>(() => {
        if (!resetAt) return 60;
        return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    });

    // Real-time countdown timer tracking when AI resets the quota in current time
    useEffect(() => {
        if (!isSemantic) return;

        const updateTimer = () => {
            const target = resetAt || (Date.now() + 60_000);
            const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
            setSecondsLeft(remaining);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [isSemantic, resetAt]);

    // If semantic results are loaded and resetAt is not yet synchronized, query current AI quota
    useEffect(() => {
        if (isSemantic && !resetAt) {
            fetch("/api/ai/recommendations")
                .then((res) => res.json())
                .then((data) => {
                    if (data?.rateLimit) {
                        updateStreamState(cacheKey, (s) => ({
                            ...s,
                            rateLimit: data.rateLimit,
                        }));
                    }
                })
                .catch(() => {});
        }
    }, [isSemantic, resetAt, cacheKey]);

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
        updateStreamState(cacheKey, () => ({ items: [], status: "streaming", isSemantic: false }));
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

            {/* Frosted-glass banner with countdown timer & action button when semantic/fallback results are loaded */}
            {isSemantic && (
                <div className="mt-6 mb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-4 sm:p-5 shadow-2xl">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">
                                    Showing Instant Semantic Results
                                </span>
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-300">
                                    Fallback
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-gray-400">
                                AI generation is paused until quota resets {secondsLeft > 0 ? (
                                    <>in <span className="font-mono font-semibold text-purple-300">{secondsLeft}s</span></>
                                ) : (
                                    <span className="font-semibold text-emerald-400">— ready to retry</span>
                                )}.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                        <button
                            type="button"
                            onClick={regeneratePage}
                            disabled={state.status === "streaming"}
                            className={secondsLeft === 0
                                ? "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-indigo-500 hover:shadow-purple-500/40 active:scale-95 cursor-pointer disabled:opacity-50"
                                : "inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-200 backdrop-blur-xl transition hover:bg-purple-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                            }
                        >
                            <RefreshCw className={`h-4 w-4 ${state.status === "streaming" ? "animate-spin" : ""}`} />
                            <span>{secondsLeft === 0 ? "Retry AI Now" : `Retry AI (${secondsLeft}s)`}</span>
                        </button>
                    </div>
                </div>
            )}

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
