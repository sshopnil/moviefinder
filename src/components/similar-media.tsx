"use client";

import { useEffect, useState } from "react";
import { getSimilarContentAction } from "@/app/actions";
import { GlassCard } from "./ui/glass-card";
import { Sparkles, Tv, ArrowRight, Star, Quote, Heart, Zap, PlayCircle, Users, Info } from "lucide-react";
import Link from "next/link";
import Image from "./ui/image";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface SimilarMediaProps {
    title: string;
    overview: string;
    genres: string[];
    type: "movie" | "tv";
}

export function SimilarMedia({ title, overview, genres, type }: SimilarMediaProps) {
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchSimilar() {
            try {
                const results = await getSimilarContentAction(title, overview, genres, type);
                if (mounted) {
                    setRecommendations(results);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch similar media", error);
                if (mounted) setLoading(false);
            }
        }

        fetchSimilar();

        return () => { mounted = false; };
    }, [title, overview, genres, type]);

    if (!loading && recommendations.length === 0) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 py-6">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-white" />
                        <span>AI Recommends</span>
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[600px] bg-white/5 rounded-2xl animate-pulse border border-white/5" />
                    ))
                    : recommendations.map((item: any, idx) => {
                        const rawScore = item.aiMeta.relevance_score;
                        const score = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);

                        return (
                            <Link
                                key={item.id}
                                href={`/${item.media_type === 'movie' ? 'movie' : 'tv'}/${item.id}`}
                                className="group block relative h-full hover:scale-[1.01] transition-transform duration-300"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="h-full flex flex-col relative overflow-hidden bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-xl">
                                    {/* Header Image Area */}
                                    <div className="aspect-video w-full relative overflow-hidden">
                                        <Image
                                            src={TMDB_IMAGE_URL.backdrop(item.backdrop_path || item.poster_path)}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
                                            alt={item.title || item.name}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />

                                        {/* Match Badge */}
                                        <div className="absolute top-3 right-3">
                                            <div className="bg-blue-600 font-bold text-white text-[10px] px-2 py-1 rounded-md shadow-lg border border-blue-400/50">
                                                {score}% Match
                                            </div>
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
                                                {item.title || item.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Content Body */}
                                    <div className="flex-1 p-5 flex flex-col gap-4">

                                        {/* Why Matches */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                                <Sparkles className="h-3 w-3" />
                                                Why it matches your mood
                                            </div>
                                            <p className="text-sm text-gray-300 italic leading-relaxed">
                                                "{item.aiMeta.reason || item.aiMeta.why_watch}"
                                            </p>
                                        </div>

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
                                                "{item.aiMeta.critics_consensus}"
                                            </p>
                                        </div>
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
            </div>
        </div>
    );
}
