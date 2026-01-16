"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { removeFromHistoryAction, clearHistoryAction } from "@/actions/history";
import { useRouter } from "next/navigation";

interface HistoryItem {
    id: number;
    title: string;
    poster_path: string | null;
    media_type: 'movie' | 'tv' | 'person';
    season?: number;
    episode?: number;
    updatedAt: string;
    progress?: number;
    duration?: number;
}

interface HistoryListProps {
    initialItems: HistoryItem[];
}

export function HistoryList({ initialItems }: HistoryListProps) {
    const [items, setItems] = useState(initialItems);
    const router = useRouter();

    const handleRemove = async (itemId: number, itemType: string) => {
        // Optimistic update
        setItems(prev => prev.filter(i => !(i.id === itemId && i.media_type === itemType)));
        await removeFromHistoryAction(itemId, itemType);
    };

    const handleClearAll = async () => {
        if (confirm("Are you sure you want to clear your entire watch history?")) {
            setItems([]);
            await clearHistoryAction();
        }
    };

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 rounded-full bg-white/5">
                    <Trash2 className="h-8 w-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">No History</h2>
                <p className="text-gray-400 max-w-sm">
                    Items you watch will appear here. Go watch something!
                </p>
                <Link href="/" className="px-6 py-2 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition-colors">
                    Browse Movies
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <button
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm font-medium border border-red-500/10"
                >
                    <Trash2 className="h-4 w-4" />
                    Clear History
                </button>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
                {items.map((item) => (
                    <div key={`${item.media_type}-${item.id}`} className="relative group">
                        <Link
                            href={`/${item.media_type}/${item.id}`}
                            className="block aspect-[2/3] relative rounded-xl overflow-hidden bg-white/5 border border-white/5 transition-transform duration-300 group-hover:scale-[1.02]"
                        >
                            {item.poster_path ? (
                                <Image
                                    src={TMDB_IMAGE_URL.poster(item.poster_path)}
                                    alt={item.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 50vw, 20vw"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 text-xs">No Image</div>
                            )}

                            {/* Content Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300" />

                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <h3 className="text-white text-sm font-bold leading-tight truncate shadow-black drop-shadow-md mb-1">
                                    {item.title}
                                </h3>

                                <div className="flex items-end justify-between gap-2">
                                    <div className="min-w-0">
                                        {(item.season !== undefined || item.episode !== undefined) ? (
                                            <p className="text-xs text-blue-300 font-medium shadow-black drop-shadow-md truncate">
                                                S{item.season} E{item.episode}
                                            </p>
                                        ) : null}
                                        <p className="text-[10px] text-gray-300 shadow-black drop-shadow-md capitalize">
                                            {item.media_type} • {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>

                                    {/* Progress Text */}
                                    {item.progress !== undefined && (
                                        <span className="text-[10px] text-gray-200 font-medium shrink-0 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm border border-white/10 shadow-sm">
                                            {Boolean(item.progress) ? `${item.progress}m` : 'Started'}
                                            {item.duration ? ` / ${item.duration}m` : ''}
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {item.progress && item.duration && (
                                    <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden w-full">
                                        <div
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${Math.min(100, (item.progress / item.duration) * 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Hover Action */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-full border border-white/20 shadow-xl">
                                    <Trash2 className="h-0 w-0" /> {/* Dummy to keep layout if needed, but we use View text before. Let's strictly use the overlay content now */}
                                    <span className="text-white font-bold text-sm">Play</span>
                                </div>
                            </div>
                        </Link>

                        <button
                            onClick={() => handleRemove(item.id, item.media_type)}
                            className="absolute top-2 right-2 p-2 bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-all border border-white/10 z-20 backdrop-blur-sm"
                            title="Remove from history"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
