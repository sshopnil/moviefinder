"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { GlassCard } from "./ui/glass-card";

const GENRES = [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 36, name: "History" },
    { id: 27, name: "Horror" },
    { id: 10402, name: "Music" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Sci-Fi" },
    { id: 53, name: "Thriller" },
    { id: 10752, name: "War" },
    { id: 37, name: "Western" },
];

export function SearchFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isOpen, setIsOpen] = useState(false);

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }
            return params.toString();
        },
        [searchParams]
    );

    const updateFilter = (name: string, value: string) => {
        router.push("/?" + createQueryString(name, value), { scroll: false });
    };

    const currentGenre = searchParams.get("with_genres") || "";
    const currentYear = searchParams.get("primary_release_year") || "";
    const currentRating = searchParams.get("vote_average.gte") || "";

    return (
        <div className="mb-8">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${isOpen || currentGenre || currentYear || currentRating
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                    }`}
            >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
            </button>

            {isOpen && (
                <GlassCard className="mt-4 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                    {/* Genre */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Genre</label>
                        <select
                            value={currentGenre}
                            onChange={(e) => updateFilter("with_genres", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 hover:bg-white/10 transition-colors"
                        >
                            <option value="" className="bg-gray-900">All Genres</option>
                            {GENRES.map((g) => (
                                <option key={g.id} value={g.id} className="bg-gray-900">
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Year */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Year</label>
                        <input
                            type="number"
                            placeholder="e.g. 2023"
                            value={currentYear}
                            onChange={(e) => updateFilter("primary_release_year", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 hover:bg-white/10 transition-colors placeholder:text-gray-600"
                        />
                    </div>

                    {/* Rating */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Min Rating</label>
                        <select
                            value={currentRating}
                            onChange={(e) => updateFilter("vote_average.gte", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 hover:bg-white/10 transition-colors"
                        >
                            <option value="" className="bg-gray-900">Any Rating</option>
                            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                                <option key={r} value={r} className="bg-gray-900">
                                    {r}+ Stars
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clear */}
                    <div className="flex items-end">
                        <button
                            onClick={() => router.push("/")}
                            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors py-2 rounded-md border border-transparent hover:border-red-500/20"
                        >
                            <X className="h-4 w-4" />
                            Clear
                        </button>
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
