"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Star, Play, Loader2 } from "lucide-react";
import { searchMultiAction } from "@/app/actions";
import { Movie, TVSeries } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function HeaderSearchIcon() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<(Movie | TVSeries)[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/?q=${encodeURIComponent(query.trim())}`);
            setExpanded(false);
            setShowSuggestions(false);
            setQuery("");
        }
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
                console.error("Header Suggestions error:", error);
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
                setExpanded(false);
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (expanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [expanded]);

    if (isHome) return null;

    return (
        <div ref={containerRef} className="relative">
            {expanded ? (
                <div className="flex flex-col">
                    <form onSubmit={handleSubmit} className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-4 duration-200">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search movies..."
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/10 min-w-[200px] w-full sm:min-w-[300px]"
                            />
                            {isLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setExpanded(false);
                                setShowSuggestions(false);
                            }}
                            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </form>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full right-0 mt-2 w-[280px] sm:w-[350px] py-1 bg-[#1a1c2c]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {suggestions.map((item) => (
                                <Link
                                    key={`${item.media_type}-${item.id}`}
                                    href={`/${item.media_type}/${item.id}`}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors group"
                                    onClick={() => {
                                        setExpanded(false);
                                        setShowSuggestions(false);
                                        setQuery("");
                                    }}
                                >
                                    <div className="relative w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-white/5">
                                        <Image
                                            src={TMDB_IMAGE_URL.poster(item.poster_path)}
                                            alt={item.media_type === "movie" ? (item as Movie).title : (item as TVSeries).name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <h4 className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition-colors text-left">
                                            {item.media_type === "movie" ? (item as Movie).title : (item as TVSeries).name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5 text-left">
                                            <div className="flex items-center gap-1 text-[9px] text-yellow-500">
                                                <Star className="h-2.5 w-2.5 fill-current" />
                                                <span>{item.vote_average.toFixed(1)}</span>
                                            </div>
                                            <span className="text-[9px] text-gray-500 uppercase">
                                                {item.media_type}
                                            </span>
                                            <span className="text-[9px] text-gray-500">
                                                {item.media_type === "movie" ? (item as Movie).release_date?.split("-")[0] : (item as TVSeries).first_air_date?.split("-")[0]}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => setExpanded(true)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 backdrop-blur-sm"
                    title="Search Movies"
                >
                    <Search className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
