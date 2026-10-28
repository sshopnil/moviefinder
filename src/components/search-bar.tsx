"use client";

import { Star, Loader2, Play, ChevronDown, Film, Tv, Bot, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { searchMultiAction } from "@/app/actions";
import { Movie, TVSeries } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import Image from "@/components/ui/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface SearchBarProps {
    onSearch?: (query: string, type: "movie" | "tv", isAI: boolean) => void;
    searchLoading?: boolean;
    className?: string;
}

export function SearchBar({ onSearch, searchLoading, className }: SearchBarProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const urlQuery = searchParams.get("mood") || searchParams.get("q") || "";
    const urlType = searchParams.get("type");
    const isInitialAI = Boolean(searchParams.get("mood"));

    const [query, setQuery] = useState(urlQuery);
    const [mediaType, setMediaType] = useState<"movie" | "tv">(urlType === "tv" ? "tv" : "movie"); // Movie by default
    const [isAIMode, setIsAIMode] = useState(isInitialAI);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [suggestions, setSuggestions] = useState<(Movie | TVSeries)[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const typeDropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const nextQuery = searchParams.get("mood") || searchParams.get("q") || "";
        const nextType = searchParams.get("type");
        const nextIsAI = Boolean(searchParams.get("mood"));

        setQuery(nextQuery);
        if (nextType === "tv" || nextType === "movie") {
            setMediaType(nextType);
        }
        setIsAIMode(nextIsAI);
        setShowSuggestions(false);
        setShowTypeDropdown(false);
    }, [searchParams]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSuggestions(false);
        setShowTypeDropdown(false);

        if (!query.trim()) {
            inputRef.current?.focus();
            return;
        }

        if (onSearch) {
            onSearch(query.trim(), mediaType, isAIMode);
        } else {
            const encoded = encodeURIComponent(query.trim());
            if (isAIMode) {
                router.push(`/?mood=${encoded}&type=${mediaType}`);
            } else {
                router.push(`/?q=${encoded}&type=${mediaType}`);
            }
        }
    };

    const handleTypeSelect = (type: "movie" | "tv") => {
        setMediaType(type);
        setShowTypeDropdown(false);

        // If on an active search results page, update the type in the URL
        const activeMood = searchParams.get("mood");
        const activeQ = searchParams.get("q");
        if (activeMood) {
            router.push(`/?mood=${encodeURIComponent(activeMood)}&type=${type}`);
        } else if (activeQ) {
            router.push(`/?q=${encodeURIComponent(activeQ)}&type=${type}`);
        }
    };

    useEffect(() => {
        if (isAIMode || !showSuggestions || query.trim().length < 1) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            setIsLoading(true);
            try {
                const results = await searchMultiAction(query);
                const items = mediaType === "tv"
                    ? results.tv
                    : mediaType === "movie"
                    ? results.movies
                    : [...results.movies, ...results.tv];
                const combined = items
                    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                    .slice(0, 5);
                setSuggestions(combined);
            } catch (error) {
                console.error("Suggestions error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [query, showSuggestions, isAIMode, mediaType]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
                setShowTypeDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className={cn("relative w-full max-w-3xl mx-auto", className)}>
            <form
                onSubmit={handleSubmit}
                className={cn(
                    "relative flex items-center w-full h-14 rounded-full border backdrop-blur-xl transition-all duration-300 shadow-xl pl-2",
                    isAIMode
                        ? "bg-[#18122B]/90 border-purple-500/40 ring-2 ring-purple-500/25 shadow-purple-950/40"
                        : "bg-white/10 border-white/15 hover:bg-white/15 focus-within:ring-2 focus-within:ring-white/20"
                )}
            >
                {/* Media Type Dropdown Menu */}
                <div ref={typeDropdownRef} className="relative flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setShowTypeDropdown(prev => !prev);
                            setShowSuggestions(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-xs sm:text-sm font-medium text-white transition-all"
                        aria-haspopup="listbox"
                        aria-expanded={showTypeDropdown}
                    >
                        {mediaType === "tv" ? (
                            <Tv className="h-3.5 w-3.5 text-blue-400" />
                        ) : (
                            <Film className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span className="font-semibold">{mediaType === "tv" ? "Series" : "Movie"}</span>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-200", showTypeDropdown && "rotate-180")} />
                    </button>

                    {showTypeDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-40 sm:w-44 p-1 bg-[#0b0b12]/95 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-2xl shadow-black/80 z-50 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                                type="button"
                                onClick={() => handleTypeSelect("movie")}
                                className={cn(
                                    "w-full flex items-center justify-between px-2 py-2 text-xs sm:text-sm text-left rounded-xl transition-all",
                                    mediaType === "movie"
                                        ? "bg-white/15 text-white font-semibold border border-white/10 shadow-sm"
                                        : "text-white/80 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <Film className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                                    <span>Movie</span>
                                </span>
                                {mediaType === "movie" && <Check className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeSelect("tv")}
                                className={cn(
                                    "w-full flex items-center justify-between px-2 py-2 text-xs sm:text-sm text-left rounded-xl transition-all mt-0.5",
                                    mediaType === "tv"
                                        ? "bg-white/15 text-white font-semibold border border-white/10 shadow-sm"
                                        : "text-white/80 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    <Tv className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                    <span>Series</span>
                                </span>
                                {mediaType === "tv" && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                            </button>
                        </div>
                    )}
                </div>

                {/* Subtle Divider */}
                <div className="h-6 w-px bg-white/15 mx-1 flex-shrink-0" />

                {/* Search Input */}
                <div className="relative flex-1 flex items-center min-w-0">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (!isAIMode) setShowSuggestions(true);
                        }}
                        onFocus={() => {
                            if (!isAIMode) setShowSuggestions(true);
                        }}
                        placeholder={
                            isAIMode
                                ? (mediaType === "tv"
                                    ? "Describe TV series mood or theme (e.g. cozy sci-fi)..."
                                    : "Describe movie mood or theme (e.g. mind-bending thriller)...")
                                : (mediaType === "tv"
                                    ? "Search TV series by title..."
                                    : "Search movies by title...")
                        }
                        className="w-full h-full px-2.5 sm:px-3 py-2 bg-transparent text-white placeholder:text-gray-400 text-xs sm:text-sm md:text-base focus:outline-none"
                    />
                </div>

                {/* Actions: AI Toggle + Submit */}
                <div className="flex items-center gap-1.5 sm:gap-2 pr-2 flex-shrink-0">
                    {/* AI Toggle Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsAIMode(prev => !prev);
                            setShowSuggestions(false);
                            inputRef.current?.focus();
                        }}
                        title={isAIMode ? "AI Search active. Click to switch to normal title search" : "Switch to AI Search (find by mood & theme)"}
                        className={cn(
                            "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 select-none",
                            isAIMode
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30 ring-1 ring-purple-400/50"
                                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                        )}
                    >
                        <Bot className={cn("h-3.5 w-3.5", isAIMode ? "text-white" : "text-gray-400")} />
                        <span className="hidden xs:inline">AI</span>
                        <span className={cn(
                            "text-[10px] uppercase tracking-wider px-1 py-0.5 rounded font-bold leading-none",
                            isAIMode ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"
                        )}>
                            {isAIMode ? "ON" : "OFF"}
                        </span>
                    </button>

                    {/* Hidden submit button to allow Enter key to submit form */}
                    <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} disabled={searchLoading} />

                    {searchLoading && (
                        <Loader2 className="h-4 w-4 text-gray-400 animate-spin mr-1" />
                    )}
                </div>
            </form>

            {/* Suggestions Dropdown (Normal Search Mode) */}
            {!isAIMode && showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-[#0b0b12]/95 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-2xl shadow-black/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                    {suggestions.map((item) => (
                        <Link
                            key={`${item.media_type}-${item.id}`}
                            href={`/${item.media_type}/${item.id}`}
                            prefetch={false}
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
