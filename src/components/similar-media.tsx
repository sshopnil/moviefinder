"use client";

import { useState } from "react";
import { Sparkles, Star, Quote, Heart, PlayCircle, Users, Info } from "lucide-react";
import Link from "next/link";
import Image from "./ui/image";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";
import { AIRecommendationCardSkeleton } from "@/components/ai-result-skeletons";

interface SimilarMediaProps {
    title: string;
    overview: string;
    genres: string[];
    type: "movie" | "tv";
    tmdbId?: number;
}

type SimilarMediaItem = {
    id: number;
    media_type?: "movie" | "tv";
    backdrop_path?: string | null;
    poster_path?: string | null;
    title?: string;
    name?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
    overview?: string;
    aiMeta?: {
        relevance_score?: number;
        source?: string;
        reason?: string;
        target_audience?: string;
        emotional_impact?: string;
        ending_mood?: string;
        critics_consensus?: string;
    };
};

export function SimilarMedia({ title, overview, genres, type, tmdbId }: SimilarMediaProps) {
    const [recommendations, setRecommendations] = useState<SimilarMediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasRun, setHasRun] = useState(false);
    const [isFallback, setIsFallback] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function fetchSimilar() {
        setHasRun(true);
        setLoading(true);
        setError(null);
        setIsFallback(false);
        setRecommendations([]);

        try {
            const response = await fetch("/api/ai/recommendations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "similar", title, overview, genres, sourceType: type, tmdbId }),
            });

            if (!response.ok || !response.body) throw new Error("Failed to start recommendation stream.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let resultCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                buffer += decoder.decode(value, { stream: !done });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const event = JSON.parse(line);

                    if (event.type === "item") {
                        resultCount++;
                        setRecommendations((current) => current.some((item) => item.id === event.item.id)
                            ? current
                            : [...current, event.item]);
                        if (event.item.aiMeta?.source === "fallback") {
                            setIsFallback(true);
                        }
                    } else if (event.type === "rateLimit") {
                        showAIRateLimitToast(event.rateLimit);
                        setError("AI recommendation limit reached. Try again in a moment.");
                    } else if (event.type === "error") {
                        setError(event.message);
                    }
                }

                if (done) break;
            }

            if (resultCount === 0) {
                setError("No recommendations were found. Try again in a moment.");
            }
        } catch (error) {
            console.error("Failed to fetch similar media", error);
            setRecommendations([]);
            setError("AI recommendations failed. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }

    function renderEmptyState() {
        return (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="absolute right-0 top-0 p-5 opacity-10">
                    <Sparkles className="h-28 w-28 text-white" />
                </div>
                <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="max-w-2xl space-y-2">
                        <h3 className="text-xl font-bold text-white">Generate AI recommendations</h3>
                        <p className="text-sm leading-6 text-gray-400">
                            Ask AI to find movies and series with a similar mood, pacing, audience, and ending vibe.
                        </p>
                        {error && <p className="text-sm text-red-300">{error}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={fetchSimilar}
                        disabled={loading}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Sparkles className="h-4 w-4" />
                        {hasRun ? "Run Again" : "Run AI Recommendations"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 py-6 relative min-h-[400px]">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-white" />
                            <span>AI Recommends</span>
                        </h2>
                    </div>
                </div>

                {/* Fallback Banner */}
                {isFallback && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
                        <Info className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-yellow-200">
                                The main AI response was unavailable, so these are semantic fallback recommendations.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {!loading && recommendations.length === 0 ? (
                renderEmptyState()
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {recommendations.map((item, idx) => {
                        const rawScore = item.aiMeta?.relevance_score ?? 80;
                        const score = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
                        const itemTitle = item.title || item.name || "Recommended title";
                        const itemPath = item.media_type === "tv" ? "tv" : "movie";
                        const isSemanticFallback = item.aiMeta?.source === "fallback";

                        return (
                            <Link
                                key={item.id}
                                href={`/${itemPath}/${item.id}`}
                                className="group block relative h-full hover:scale-[1.01] transition-transform duration-300"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="h-full flex flex-col relative overflow-hidden bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl">
                                        {/* Header Image Area */}
                                        <div className="aspect-video w-full relative overflow-hidden">
                                            <Image
                                                src={TMDB_IMAGE_URL.backdrop(item.backdrop_path || item.poster_path || null)}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                                                alt={itemTitle}
                                            />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

                                        {/* Match Badge */}
                                        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                                            <div className="bg-blue-600 font-bold text-white text-[10px] px-2 py-1 rounded-md shadow-lg border border-blue-400/50">
                                                {isSemanticFallback ? "Semantic match" : `${score}% Match`}
                                            </div>
                                            {isSemanticFallback && (
                                                <div className="bg-yellow-500/90 font-bold text-white text-[9px] px-2 py-0.5 rounded-md shadow-lg border border-yellow-400/50 uppercase tracking-wider">
                                                    Semantic
                                                </div>
                                            )}
                                        </div>

                                        {/* Title & Rating Overlay */}
                                        <div className="absolute bottom-4 left-4 right-4 z-10">
                                            <div className="flex items-center gap-2 mb-1">
                                                {item.media_type === 'tv' && (
                                                    <span className="bg-white/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm">TV</span>
                                                )}
                                                <div className="flex items-center gap-1 text-yellow-400">
                                                    <Star className="h-3 w-3 fill-yellow-400" />
                                                    <span className="text-sm font-bold">{item.vote_average?.toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">
                                                {itemTitle}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Content Body */}
                                    <div className="flex-1 p-5 flex flex-col gap-4">

                                        {/* Why Matches */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                                <Sparkles className="h-3 w-3" />
                                                 {isSemanticFallback ? "Related through TMDB themes" : "Why it matches your mood"}
                                             </div>
                                            {!isSemanticFallback && item.aiMeta?.reason ? (
                                                <p className="text-sm text-gray-300 italic leading-relaxed">&quot;{item.aiMeta.reason}&quot;</p>
                                            ) : (
                                                <p className="text-sm leading-relaxed text-gray-400">
                                                    Matched from TMDB keywords and related title signals, not generated AI analysis.
                                                </p>
                                            )}
                                        </div>

                                        {/* Content Switch: AI Details vs Standard Overview */}
                                        {!isSemanticFallback && item.aiMeta?.target_audience ? (
                                            <>
                                                {/* For Whom / Feeling Grid */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">
                                                            <Users className="h-3 w-3" />
                                                            For Whom
                                                        </div>
                                                        <p className="text-xs text-gray-400 leading-snug">
                                                            {item.aiMeta.target_audience}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-1">
                                                            <Heart className="h-3 w-3" />
                                                            Feeling
                                                        </div>
                                                        <p className="text-xs text-gray-400 leading-snug">
                                                            {item.aiMeta.emotional_impact}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Ending Vibe */}
                                                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">
                                                        <Info className="h-3 w-3" />
                                                        The Ending Vibe
                                                    </div>
                                                    <p className="text-sm text-blue-100/80 leading-snug">
                                                        {item.aiMeta.ending_mood}
                                                    </p>
                                                </div>

                                                {/* Critics Consensus */}
                                                <div className="mt-auto pt-2">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                                                        <Quote className="h-3 w-3" />
                                                        Critics Consensus
                                                    </div>
                                                    <p className="text-xs text-gray-400 italic">
                                                        &quot;{item.aiMeta.critics_consensus}&quot;
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            /* Fallback: Show Standard Overview */
                                            <div className="mt-2 space-y-3">
                                                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                        Overview
                                                    </div>
                                                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">
                                                        {item.overview || "No overview available."}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Box Footer */}
                                    <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium">
                                            {item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0]}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest">
                                            Details <PlayCircle className="h-3 w-3" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                    {loading && Array.from({ length: Math.max(0, 6 - recommendations.length) }, (_, item) => (
                        <AIRecommendationCardSkeleton key={`pending-${item}`} />
                    ))}
                </div>
            )}
        </div>
    );
}
