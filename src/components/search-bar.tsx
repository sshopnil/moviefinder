"use client";

import { Search, Star, Loader2, Play } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { searchMultiAction } from "@/app/actions";
import { Movie, TVSeries } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import Image from "@/components/ui/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchBarProps {
    onSearch: (query: string) => void;
    searchLoading?: boolean;
    className?: string;
}

export function SearchBar({ onSearch, searchLoading, className }: SearchBarProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<(Movie | TVSeries)[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false);
        onSearch(query);
    };

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (query.trim().length < 1) {
                setSuggestions([]);
                return;
            }

            setIsLoading(true);
            try {
                const results = await searchMultiAction(query);
                const combined = [...results.movies, ...results.tv].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
                setSuggestions(combined);
            } catch (error) {
                console.error("Suggestions error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className={cn("relative w-full max-w-2xl mx-auto", className)}>
            <form onSubmit={handleSubmit} className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search for movies..."
                    className="w-full h-12 pl-12 pr-4 rounded-full bg-white/10 border border-white/10 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 backdrop-blur-md transition-all group-hover:bg-white/15"
                />
                <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer z-20 hover:text-white transition-colors"
                    onClick={() => {
                        inputRef.current?.focus();
                        setShowSuggestions(true);
                    }}
                >
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isLoading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                    <button
                        type="submit"
                        className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
                    >
                        {searchLoading ? "Searching..." : "Search"}
                    </button>
                </div>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-[#1a1c2c]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                    {suggestions.map((item) => (
                        <Link
                            key={`${item.media_type}-${item.id}`}
                            href={`/${item.media_type}/${item.id}`}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group text-left"
                            onClick={() => setShowSuggestions(false)}
                        >
                            <div className="relative w-10 h-14 flex-shrink-0 rounded overflow-hidden">
                                <Image
                                    src={TMDB_IMAGE_URL.poster(item.poster_path)}
                                    alt={item.media_type === "movie" ? (item as Movie).title : (item as TVSeries).name}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <h4 className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors text-left">
                                    {item.media_type === "movie" ? (item as Movie).title : (item as TVSeries).name}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 text-left">
                                    <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                                        <Star className="h-3 w-3 fill-current" />
                                        <span>{item.vote_average.toFixed(1)}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                        {item.media_type}
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        {item.media_type === "movie" ? (item as Movie).release_date?.split("-")[0] : (item as TVSeries).first_air_date?.split("-")[0]}
                                    </span>
                                </div>
                            </div>
                            <Play className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
