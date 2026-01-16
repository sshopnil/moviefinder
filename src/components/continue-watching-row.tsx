"use client";

import { Movie } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import Link from "next/link";
import Image from "@/components/ui/image";
import { PlayCircle } from "lucide-react";
import { useRef } from "react";

interface ContinueWatchingItem {
    id: number;
    title: string;
    poster_path: string | null;
    media_type: 'movie' | 'tv' | 'person';
    season?: number;
    episode?: number;
    progress?: number;
    duration?: number;
}

interface ContinueWatchingRowProps {
    items: ContinueWatchingItem[];
}

export function ContinueWatchingRow({ items }: ContinueWatchingRowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Continue Watching</h2>
                <Link href="/history" className="text-sm text-blue-400 hover:underline">
                    View All History
                </Link>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x"
            >
                {items.map((item) => (
                    <Link
                        key={`${item.media_type}-${item.id}`}
                        href={item.media_type === 'tv' && item.season && item.episode
                            ? `/tv/${item.id}?season=${item.season}&episode=${item.episode}`
                            : `/${item.media_type}/${item.id}`
                        }
                        className="relative min-w-[200px] aspect-[16/9] rounded-xl overflow-hidden group snap-start border border-white/5 bg-white/5"
                    >
                        {item.poster_path ? (
                            <Image
                                src={TMDB_IMAGE_URL.backdrop(item.poster_path)} // Use backdrop or poster? Poster might be cropped awkwardly in 16:9. Let's try poster with object-cover or just stick to poster aspect ratio?
                                // Actually, "Continue Watching" usually looks good with landscape (Backdrop), but we might only have poster path in history?
                                // RecentlyViewed model logs 'poster_path'. usually main poster.
                                // Let's stick to standard poster aspect ratio for consistency with other lists or maybe 16:9 if we had backdrops.
                                // If we only have poster, let's use 2:3 aspect ratio card.
                                alt={item.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="200px"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 text-xs">No Image</div>
                        )}

                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

                        {/* Play Icon */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle className="h-10 w-10 text-white fill-white/20" />
                        </div>

                        {/* Progress / Info Badge */}
                        <div className="absolute bottom-2 left-2 right-2">
                            <h3 className="text-white font-bold text-sm truncate shadow-black drop-shadow-md">{item.title}</h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    {item.media_type === 'tv' && item.season && item.episode ? (
                                        <p className="text-xs text-blue-300 font-medium shadow-black drop-shadow-md">
                                            S{item.season} E{item.episode}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-300 shadow-black drop-shadow-md capitalize">
                                            {item.media_type}
                                        </p>
                                    )}
                                </div>
                                {item.progress !== undefined && (
                                    <span className="text-[10px] text-gray-200 font-medium shrink-0 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10 shadow-sm">
                                        {Boolean(item.progress) ? `${item.progress}m` : 'Started'} {item.duration ? `/ ${item.duration}m` : ''}
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar */}
                            {item.progress && item.duration && (
                                <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden w-full">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${Math.min(100, (item.progress / item.duration) * 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
