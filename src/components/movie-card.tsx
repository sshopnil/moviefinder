"use client";

import { useContext } from "react";
import { CardWatchedOverlay } from "@/components/card-watched-overlay";
import { WatchedContext } from "@/components/watched-context";
import { Movie, TVSeries } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { Star, PlayCircle } from "lucide-react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn, normalizeScore } from "@/lib/utils";

interface MovieCardProps {
    movie: Movie | TVSeries;
    matchScore?: number;
    aiReason?: string;
    character?: string;
}

export function MovieCard({ movie, matchScore, aiReason, character }: MovieCardProps) {
    const isTV = 'name' in movie;
    const title = isTV ? (movie as TVSeries).name : (movie as Movie).title;
    const date = isTV ? (movie as TVSeries).first_air_date : (movie as Movie).release_date;
    const href = isTV ? `/tv/${movie.id}` : `/movie/${movie.id}`;

    const watchedContext = useContext(WatchedContext);
    const isItemWatched = watchedContext?.isAuthenticated ? watchedContext.isWatched(movie as any) : false;

    const rawScore = typeof matchScore === "number"
        ? matchScore
        : (typeof (movie as any).match_score === "number"
            ? (movie as any).match_score
            : (typeof (movie as any).relevance_score === "number"
                ? (movie as any).relevance_score
                : (movie as any).aiMeta?.relevance_score));

    const normalized = typeof rawScore === "number" && Number.isFinite(rawScore)
        ? normalizeScore(rawScore)
        : 0;

    const displayScore = normalized > 0 ? normalized : null;

    const displayReason = aiReason || (movie as any).reason || (movie as any).aiMeta?.reason || "";
    const displayCharacter = character || (movie as any).character || (movie as any).aiMeta?.character || "";

    return (
        <Link href={href} prefetch={false} className="block w-full min-w-0">
            <div
                className="group relative h-[260px] xs:h-[280px] sm:h-[400px] w-full cursor-pointer overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/5 transition-all hover:ring-white/20"
            >
                <Image
                    src={TMDB_IMAGE_URL.poster(movie.poster_path)}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 400px) 100vw, (max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-90" />

                <CardWatchedOverlay movie={movie as any} />

                {/* AI Match Score Badge */}
                {displayScore !== null && (
                    <div className={cn("absolute right-2.5 z-10 transition-all", isItemWatched ? "top-10" : "top-2.5")}>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/95 text-white backdrop-blur-md border border-purple-400/30 shadow-lg shadow-purple-950/70">
                            {displayScore}% Match
                        </span>
                    </div>
                )}

                {/* Hover Play Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
                    <PlayCircle className="h-12 w-12 text-blue-500 fill-blue-500/20" />
                </div>

                <div className="absolute bottom-0 left-0 w-full p-4 transform transition-transform duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                            {isTV ? 'TV' : 'Movie'}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
                            <Star className="h-3 w-3 fill-yellow-500" />
                            {(movie.vote_average ?? 0).toFixed(1)}
                        </span>
                    </div>
                    <h3 className="line-clamp-1 text-sm sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight w-full truncate">{title}</h3>
                    {displayCharacter && (
                        <p className="line-clamp-1 text-[11px] font-medium text-gray-300 truncate">
                            as {displayCharacter}
                        </p>
                    )}
                    {displayReason && (
                        <p className="line-clamp-2 text-[10px] sm:text-[11px] text-purple-200/90 italic mt-0.5 leading-snug">
                            &ldquo;{displayReason}&rdquo;
                        </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium mt-1">
                        <span>{date ? new Date(date).getFullYear() : 'N/A'}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Click to View</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
