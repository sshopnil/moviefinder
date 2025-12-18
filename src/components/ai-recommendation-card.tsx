"use client";

import { Movie, TVSeries, AIRecommendation } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { Star, PlayCircle, Users, Sparkles, Heart, Info, Quote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface AIRecommendationCardProps {
    movie: (Movie | TVSeries) & { aiMeta?: AIRecommendation };
}

export function AIRecommendationCard({ movie }: AIRecommendationCardProps) {
    const isTV = 'name' in movie;
    const title = isTV ? (movie as TVSeries).name : (movie as Movie).title;
    const date = isTV ? (movie as TVSeries).first_air_date : (movie as Movie).release_date;
    const href = isTV ? `/tv/${movie.id}` : `/movie/${movie.id}`;
    const meta = movie.aiMeta;

    if (!meta) return null;

    return (
        <div className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 flex flex-col h-full shadow-2xl">
            {/* Poster Section */}
            <div className="relative aspect-[16/9] w-full overflow-hidden">
                <Image
                    src={TMDB_IMAGE_URL.backdrop(movie.backdrop_path || movie.poster_path)}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {/* Score Badge */}
                <div className="absolute top-3 right-3 px-2 py-1 bg-blue-600/90 text-white text-[10px] font-bold rounded-md backdrop-blur-sm border border-white/20">
                    {meta.relevance_score}% Match
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white text-black uppercase">
                            {isTV ? 'TV' : 'Movie'}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
                            <Star className="h-3 w-3 fill-yellow-500" />
                            {movie.vote_average.toFixed(1)}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-white line-clamp-1">{title}</h3>
                </div>

                <Link href={href} className="absolute inset-0 z-10">
                    <span className="sr-only">View Details</span>
                </Link>
            </div>

            {/* AI Insights Content */}
            <div className="p-4 flex flex-col gap-4 flex-1 text-xs">
                {/* Why Watch & Reason */}
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold text-blue-400 uppercase tracking-wider text-[9px]">Why it matches your mood</p>
                            <p className="text-gray-300 leading-relaxed italic">"{meta.reason}"</p>
                        </div>
                    </div>
                </div>

                {/* Grid of Details */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users className="h-3 w-3 text-purple-400" />
                            <span className="font-bold text-[9px] text-purple-400 uppercase">For Whom</span>
                        </div>
                        <p className="text-gray-400 line-clamp-2 leading-tight">{meta.target_audience}</p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Heart className="h-3 w-3 text-red-400" />
                            <span className="font-bold text-[9px] text-red-400 uppercase">Feeling</span>
                        </div>
                        <p className="text-gray-400 line-clamp-2 leading-tight">{meta.emotional_impact}</p>
                    </div>
                </div>

                {/* The End Vibe */}
                <div className="bg-blue-500/10 rounded-lg p-2.5 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Info className="h-3 w-3 text-blue-300" />
                        <span className="font-bold text-[9px] text-blue-300 uppercase">The Ending Vibe</span>
                    </div>
                    <p className="text-blue-200/80 leading-snug">{meta.ending_mood}</p>
                </div>

                {/* Critics Section */}
                <div className="mt-auto pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Quote className="h-3 w-3 text-gray-500" />
                        <span className="font-bold text-[9px] text-gray-500 uppercase italic">Critics Consensus</span>
                    </div>
                    <p className="text-gray-500 leading-snug italic line-clamp-2">
                        "{meta.critics_consensus}"
                    </p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500">{date ? new Date(date).getFullYear() : 'N/A'}</span>
                <Link href={href} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors flex items-center gap-1">
                    Details <PlayCircle className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
