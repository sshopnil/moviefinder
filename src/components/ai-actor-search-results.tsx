"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { User, Film, Tv, ChevronDown, ChevronUp, AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Movie, TVSeries, AIRecommendation, AIRateLimitInfo } from "@/types/movie";
import { getActorAIRecommendationsAction } from "@/app/actions";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { MovieGrid } from "@/components/movie-grid";
import { MovieBrowser } from "@/components/movie-browser";
import { AIRecommendationCardSkeleton } from "@/components/ai-result-skeletons";
import { FavoriteActorButton } from "@/components/favorite-actor-button";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";
import Image from "@/components/ui/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AIActorSearchResultsProps {
    mood: string;
    actorId: number;
    actorName: string;
    initialProfilePath?: string | null;
}

type MatchedItem = (Movie | TVSeries) & { aiMeta?: AIRecommendation };

export function AIActorSearchResults({ mood, actorId, actorName, initialProfilePath }: AIActorSearchResultsProps) {
    // Section 1 State: Actor Works
    const [actorLoading, setActorLoading] = useState(true);
    const [actorMatches, setActorMatches] = useState<MatchedItem[]>([]);
    const [allCredits, setAllCredits] = useState<(Movie | TVSeries)[]>([]);
    const [actorProfilePath, setActorProfilePath] = useState<string | null>(initialProfilePath || null);
    const [disclaimer, setDisclaimer] = useState<string | undefined>();
    const [showFullFilmography, setShowFullFilmography] = useState(false);
    const [actorError, setActorError] = useState<string | null>(null);

    // Section 2 State: Contextual Recommendations
    const [formatFilter, setFormatFilter] = useState<"all" | "movie" | "tv">("all");
    const [contextItems, setContextItems] = useState<MatchedItem[]>([]);
    const [contextLoading, setContextLoading] = useState(true);
    const [contextError, setContextError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Fetch Section 1: Actor evaluation
    useEffect(() => {
        let isMounted = true;
        setActorLoading(true);
        setActorError(null);

        async function fetchActorData() {
            try {
                const res = await getActorAIRecommendationsAction(actorId, actorName, mood);
                if (!isMounted) return;

                setActorMatches(res.actorMatches || []);
                setAllCredits(res.allCredits || []);
                setDisclaimer(res.disclaimer);

                if (res.actorDetails?.profile_path) {
                    setActorProfilePath(res.actorDetails.profile_path);
                }

                if (res.rateLimit) {
                    showAIRateLimitToast(res.rateLimit);
                }
            } catch (err: any) {
                if (!isMounted) return;
                console.error("Failed to load actor AI results:", err);
                setActorError("Unable to evaluate actor filmography. Please try again.");
            } finally {
                if (isMounted) setActorLoading(false);
            }
        }

        fetchActorData();
        return () => {
            isMounted = false;
        };
    }, [actorId, actorName, mood]);

    // Fetch Section 2: Contextual recommendations streaming
    useEffect(() => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setContextLoading(true);
        setContextItems([]);
        setContextError(null);

        async function streamContextRecommendations() {
            try {
                // Collect titles to exclude so Section 2 has no duplicates with Section 1
                const excludeTitles = actorMatches.map((m) => ("name" in m ? m.name : m.title));

                const response = await fetch("/api/ai/recommendations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mode: "mood",
                        mood,
                        excludeTitles,
                        type: formatFilter === "all" ? undefined : formatFilter,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok || !response.body) {
                    throw new Error("Failed to start recommendation stream.");
                }

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
                        try {
                            const event = JSON.parse(trimmed);
                            if (event.type === "item" && event.item) {
                                setContextItems((prev) => {
                                    const key = `${event.item.media_type || "movie"}-${event.item.id}`;
                                    if (prev.some((i) => `${i.media_type || "movie"}-${i.id}` === key)) {
                                        return prev;
                                    }
                                    return [...prev, event.item];
                                });
                            } else if (event.type === "rateLimit" || event.type === "quota") {
                                if (event.rateLimit) showAIRateLimitToast(event.rateLimit);
                            } else if (event.type === "error") {
                                setContextError(event.message);
                            }
                        } catch {
                            // Ignore unparseable fragments
                        }
                    }

                    if (done) break;
                }
            } catch (err: any) {
                if (controller.signal.aborted) return;
                console.error("Context recommendation error:", err);
                setContextError("Could not complete contextual recommendations.");
            } finally {
                if (!controller.signal.aborted) {
                    setContextLoading(false);
                }
            }
        }

        streamContextRecommendations();

        return () => {
            controller.abort();
        };
    }, [mood, formatFilter, actorMatches]);

    return (
        <div className="space-y-16 animate-in fade-in duration-300">
            {/* SECTION 1: Actor Works Matching Vibe */}
            <section className="space-y-6">
                {/* Actor Focus Header Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-indigo-950/60 border border-purple-500/30 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {/* Actor Profile Picture */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden flex-shrink-0 bg-black/40 ring-2 ring-purple-400/40 shadow-xl">
                            {actorProfilePath ? (
                                <Image
                                    src={TMDB_IMAGE_URL.profile(actorProfilePath)}
                                    alt={actorName}
                                    fill
                                    className="object-cover"
                                    sizes="120px"
                                    priority
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-purple-300">
                                    <User className="h-10 w-10 opacity-70" />
                                </div>
                            )}
                        </div>

                        {/* Actor Meta Info */}
                        <div className="flex-1 text-center sm:text-left space-y-2">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold tracking-wider uppercase">
                                    AI Actor Focus
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-medium">
                                    {allCredits.length} Credits on TMDB
                                </span>
                            </div>

                            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                                {actorName}
                            </h1>

                            <p className="text-gray-300 text-sm sm:text-base max-w-2xl">
                                AI evaluated filmography matching:{" "}
                                <span className="text-purple-300 font-semibold italic">&quot;{mood}&quot;</span>
                            </p>

                            {/* Profile Link & Favorite Button */}
                            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                <Link
                                    href={`/person/${actorId}`}
                                    prefetch={false}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold border border-white/10 transition-colors"
                                >
                                    <span>Full Actor Profile</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                                </Link>

                                <FavoriteActorButton
                                    actor={{
                                        id: actorId,
                                        name: actorName,
                                        profile_path: actorProfilePath,
                                        known_for_department: "Acting",
                                    }}
                                    isFavoriteInitial={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer banner if no titles strongly match the vibe */}
                {disclaimer && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm animate-in fade-in">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-300">Vibe Match Note</p>
                            <p className="text-amber-200/90 text-xs sm:text-sm mt-0.5">{disclaimer}</p>
                        </div>
                    </div>
                )}

                {/* Actor Works Grid */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                            {actorName}&apos;s Top Matches ({actorMatches.length})
                        </h2>

                        {allCredits.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowFullFilmography((prev) => !prev)}
                                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
                            >
                                <span>{showFullFilmography ? "Hide Filmography" : "View All Filmography"}</span>
                                {showFullFilmography ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                            </button>
                        )}
                    </div>

                    {actorLoading ? (
                        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <AIRecommendationCardSkeleton key={`actor-skel-${idx}`} />
                            ))}
                        </div>
                    ) : actorError ? (
                        <div className="text-center py-12 text-gray-400 bg-white/5 rounded-2xl border border-white/10 p-6">
                            <p>{actorError}</p>
                        </div>
                    ) : actorMatches.length > 0 ? (
                        <MovieGrid movies={actorMatches} title="" />
                    ) : (
                        <div className="text-center py-12 text-gray-400 bg-white/5 rounded-2xl border border-white/10 p-6">
                            No evaluated matches available for this actor.
                        </div>
                    )}
                </div>

                {/* Expandable Full Filmography Section */}
                {showFullFilmography && allCredits.length > 0 && (
                    <div className="p-6 rounded-3xl bg-black/40 border border-white/10 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="border-b border-white/10 pb-4">
                            <h3 className="text-xl font-bold text-white">
                                Complete Filmography for {actorName}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-400">
                                Browse all {allCredits.length} movies and TV series starring {actorName}.
                            </p>
                        </div>
                        <MovieBrowser movies={allCredits} />
                    </div>
                )}
            </section>

            {/* SECTION 2: Relevant Context Movies & TV Series from AI mode */}
            <section className="space-y-6 pt-6 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                More Movies & TV Series Matching Your Vibe
                            </h2>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1">
                            Relevant titles in cinema and television beyond {actorName} matching &quot;{mood}&quot;
                        </p>
                    </div>

                    {/* Format Filter Pills (All / Movies / Series) */}
                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setFormatFilter("all")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                formatFilter === "all"
                                    ? "bg-white/20 text-white shadow-sm"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormatFilter("movie")}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                formatFilter === "movie"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Film className="w-3.5 h-3.5 text-amber-400" />
                            <span>Movies</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormatFilter("tv")}
                            className={cn(
                                "flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                formatFilter === "tv"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Tv className="w-3.5 h-3.5 text-blue-400" />
                            <span>Series</span>
                        </button>
                    </div>
                </div>

                {/* Contextual Recommendations Grid */}
                {contextError && contextItems.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white/5 rounded-2xl border border-white/10 p-6">
                        <p>{contextError}</p>
                    </div>
                ) : (
                    <MovieGrid
                        movies={contextItems}
                        title=""
                        pendingCount={contextLoading ? Math.max(1, 6 - contextItems.length) : 0}
                    />
                )}
            </section>
        </div>
    );
}

