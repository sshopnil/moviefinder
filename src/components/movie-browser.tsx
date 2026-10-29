"use strict";
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Movie, TVSeries } from "@/types/movie";
import { MovieCard } from "@/components/movie-card";
import { Search, Film, Tv, LayoutGrid, Bot, X, Loader2, AlertCircle } from "lucide-react";
import { MOVIE_GENRES } from "@/lib/genres";
import { getActorAIRecommendationsAction } from "@/app/actions";
import { cn, normalizeScore } from "@/lib/utils";

interface MovieBrowserProps {
    movies: (Movie | TVSeries)[];
    title?: string;
    description?: string;
    actorId?: number;
    actorName?: string;
    actorPerson?: any;
    initialMood?: string;
    initialAIMatches?: any[];
    initialDisclaimer?: string;
}

type BrowsableMedia = (Movie | TVSeries) & { name?: string; title?: string };

function getMediaTitle(media: BrowsableMedia) {
    return media.title || media.name || "Untitled";
}

function getMediaDate(media: BrowsableMedia) {
    if ("first_air_date" in media && media.first_air_date) return media.first_air_date;
    if ("release_date" in media && media.release_date) return media.release_date;
    return "";
}

function getMediaType(media: BrowsableMedia): "movie" | "tv" {
    if (media.media_type === "movie" || (media as any).type === "movie" || (media as any).aiMeta?.type === "movie") return "movie";
    if (media.media_type === "tv" || (media as any).type === "tv" || (media as any).aiMeta?.type === "tv") return "tv";
    if ("first_air_date" in media || "name" in media) return "tv";
    return "movie";
}

const SORT_OPTIONS = [
    { value: "popularity_desc", label: "Most Popular" },
    { value: "date_desc", label: "Newest Releases" },
    { value: "date_asc", label: "Oldest Releases" },
    { value: "rating_desc", label: "Highest Rated" },
    { value: "rating_asc", label: "Lowest Rated" },
];

export function MovieBrowser({
    movies,
    title,
    description,
    actorId,
    actorName,
    actorPerson,
    initialMood,
    initialAIMatches,
    initialDisclaimer,
}: MovieBrowserProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // AI Mode States
    const [isAIMode, setIsAIMode] = useState(() => Boolean(initialMood));
    const [aiInput, setAiInput] = useState(() => initialMood || "");
    const [activeAIMood, setActiveAIMood] = useState(() => initialMood || "");
    const [aiMatches, setAIMatches] = useState<any[]>(() => initialAIMatches || []);
    const [aiDisclaimer, setAIDisclaimer] = useState<string | undefined>(() => initialDisclaimer);
    const [isAILoading, setIsAILoading] = useState(false);

    // Standard Browser States
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("all");
    const [sortBy, setSortBy] = useState(() => (initialMood ? "ai_match" : "popularity_desc"));
    const [formatFilter, setFormatFilter] = useState<"all" | "movie" | "tv">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Track previous initialMood to only sync when external prop changes (e.g. route/history navigation)
    const prevInitialMoodRef = useRef(initialMood);

    // Sync state if initialMood changes externally
    useEffect(() => {
        if (initialMood !== prevInitialMoodRef.current) {
            prevInitialMoodRef.current = initialMood;
            if (initialMood) {
                setIsAIMode(true);
                setAiInput(initialMood);
                setActiveAIMood(initialMood);
                setAIMatches(initialAIMatches || []);
                setAIDisclaimer(initialDisclaimer);
                setSortBy("ai_match");
                setCurrentPage(1);
            } else {
                setIsAIMode(false);
                setAiInput("");
                setActiveAIMood("");
                setAIMatches([]);
                setAIDisclaimer(undefined);
                setSortBy("popularity_desc");
                setCurrentPage(1);
            }
        }
    }, [initialMood, initialAIMatches, initialDisclaimer]);

    // Fast O(1) lookup map for AI evaluated matches
    const aiMatchesMap = useMemo(() => {
        const map = new Map<string, { match_score: number; reason: string; character?: string }>();
        for (const match of aiMatches) {
            if (!match || !match.id) continue;
            const mediaType = getMediaType(match);
            const rawScore = match.match_score ?? match.relevance_score ?? match.aiMeta?.relevance_score;
            const score = normalizeScore(rawScore);
            const reason = match.reason || match.aiMeta?.reason || "";
            const character = match.character || (match as any).aiMeta?.character || "";
            const entry = {
                match_score: score,
                reason,
                character,
            };
            const key = `${mediaType}:${match.id}`;
            map.set(key, entry);
            if (!map.has(`any:${match.id}`)) {
                map.set(`any:${match.id}`, entry);
            }
        }
        return map;
    }, [aiMatches]);

    // Deduplicate incoming items by media_type and id
    const uniqueMovies = useMemo(() => {
        const seen = new Set<string>();
        const list: (Movie | TVSeries)[] = [];
        for (const item of movies) {
            if (!item || !item.id) continue;
            const key = `${getMediaType(item)}:${item.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                list.push(item);
            }
        }
        return list;
    }, [movies]);

    const movieCount = useMemo(() => uniqueMovies.filter(m => getMediaType(m) === "movie").length, [uniqueMovies]);
    const tvCount = useMemo(() => uniqueMovies.filter(m => getMediaType(m) === "tv").length, [uniqueMovies]);

    // Extract unique genres from available media
    const availableGenres = useMemo(() => {
        const genreIds = new Set<number>();
        uniqueMovies.forEach(movie => {
            movie.genre_ids?.forEach(id => genreIds.add(id));
        });
        return MOVIE_GENRES.filter(g => genreIds.has(g.id));
    }, [uniqueMovies]);

    // Handle AI Search Submission
    const handleAISubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = aiInput.trim();
        if (!trimmed || !actorId || !actorName) return;

        setIsAILoading(true);
        try {
            const personPayload = actorPerson || { id: actorId, name: actorName };
            const res = await getActorAIRecommendationsAction(actorId, actorName, trimmed, uniqueMovies, personPayload);
            const matches = res.actorMatches || [];
            setAIMatches(matches);
            setAIDisclaimer(res.disclaimer);
            setActiveAIMood(trimmed);
            setSortBy("ai_match");
            setCurrentPage(1);
            prevInitialMoodRef.current = trimmed;

            // Sync URL query string without reloading page
            const params = new URLSearchParams(searchParams.toString());
            params.set("mood", trimmed);
            router.replace(`?${params.toString()}`, { scroll: false });
        } catch (error) {
            console.error("Failed to run actor AI search:", error);
        } finally {
            setIsAILoading(false);
        }
    };

    // Clear AI Search
    const clearAISearch = () => {
        setAiInput("");
        setActiveAIMood("");
        setAIMatches([]);
        setAIDisclaimer(undefined);
        setSortBy("popularity_desc");
        setCurrentPage(1);
        prevInitialMoodRef.current = undefined;

        // Remove mood param from URL
        const params = new URLSearchParams(searchParams.toString());
        params.delete("mood");
        const qs = params.toString();
        router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    };

    const toggleAIMode = (enabled: boolean) => {
        setIsAIMode(enabled);
        if (!enabled && activeAIMood) {
            clearAISearch();
        }
    };

    const filteredAndSortedMovies = useMemo(() => {
        let result = [...uniqueMovies];

        // 1. In Active AI Mode: filter to matches and rank by match score
        const isAISearchActive = Boolean(activeAIMood);
        const hasActiveAI = Boolean(activeAIMood && aiMatchesMap.size > 0);
        if (isAISearchActive) {
            if (hasActiveAI) {
                result = result.filter(m => {
                    const key = `${getMediaType(m)}:${m.id}`;
                    return aiMatchesMap.has(key) || aiMatchesMap.has(`any:${m.id}`);
                });
            } else {
                result = [];
            }
        }

        // 2. Format Filter (All / Movies / Series)
        if (formatFilter !== "all") {
            result = result.filter(m => getMediaType(m) === formatFilter);
        }

        // 3. Search Query (Title search in normal mode)
        if (!hasActiveAI && searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m => getMediaTitle(m).toLowerCase().includes(q));
        }

        // 4. Genre Filter
        if (selectedGenre !== "all") {
            const genreId = parseInt(selectedGenre);
            result = result.filter(m => m.genre_ids?.includes(genreId));
        }

        // 5. Sorting
        result.sort((a, b) => {
            if (sortBy === "ai_match" && hasActiveAI) {
                const infoA = aiMatchesMap.get(`${getMediaType(a)}:${a.id}`) || aiMatchesMap.get(`any:${a.id}`);
                const infoB = aiMatchesMap.get(`${getMediaType(b)}:${b.id}`) || aiMatchesMap.get(`any:${b.id}`);
                const scoreA = infoA?.match_score || 0;
                const scoreB = infoB?.match_score || 0;
                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }
                return (b.popularity || 0) - (a.popularity || 0);
            }

            switch (sortBy) {
                case "date_desc":
                    return new Date(getMediaDate(b) || "1900").getTime() - new Date(getMediaDate(a) || "1900").getTime();
                case "date_asc":
                    return new Date(getMediaDate(a) || "2100").getTime() - new Date(getMediaDate(b) || "2100").getTime();
                case "rating_desc":
                    return (b.vote_average || 0) - (a.vote_average || 0);
                case "rating_asc":
                    return (a.vote_average || 0) - (b.vote_average || 0);
                case "popularity_desc":
                default:
                    return (b.popularity || 0) - (a.popularity || 0);
            }
        });

        return result;
    }, [uniqueMovies, activeAIMood, aiMatchesMap, formatFilter, searchQuery, selectedGenre, sortBy]);

    // Calculate pagination properties
    const totalItems = filteredAndSortedMovies.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
    const paginatedMovies = filteredAndSortedMovies.slice(
        (safeCurrentPage - 1) * itemsPerPage,
        safeCurrentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const isAISearchActive = Boolean(activeAIMood);
    const hasActiveAI = Boolean(activeAIMood && aiMatchesMap.size > 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                {title && <h2 className="text-2xl font-bold text-white">{title} ({movies.length})</h2>}
                {description && <p className="text-gray-400">{description}</p>}

                <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                    <p className="text-gray-400 text-sm">
                        Showing {paginatedMovies.length > 0 ? (safeCurrentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(safeCurrentPage * itemsPerPage, totalItems)} of {totalItems} titles
                    </p>

                    {/* Format Filter Tabs */}
                    {movieCount > 0 && tvCount > 0 && (
                        <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setFormatFilter("all");
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    formatFilter === "all"
                                        ? "bg-white/20 text-white shadow-sm"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span>All ({movies.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormatFilter("movie");
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    formatFilter === "movie"
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Film className="w-3.5 h-3.5 text-amber-400" />
                                <span>Movies ({movieCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFormatFilter("tv");
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                    formatFilter === "tv"
                                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Tv className="w-3.5 h-3.5 text-blue-400" />
                                <span>Series ({tvCount})</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Active AI Matches Banner */}
            {isAISearchActive && (
                <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/30 backdrop-blur-md">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 shrink-0">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="text-xs sm:text-sm text-gray-200 leading-snug">
                                <span>AI evaluated filmography matching: </span>
                                <span className="font-semibold text-purple-300 italic">&ldquo;{activeAIMood}&rdquo;</span>
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold border border-purple-500/30">
                                    {totalItems} {totalItems === 1 ? "match" : "matches"}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={clearAISearch}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors w-fit shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Clear AI Filter</span>
                        </button>
                    </div>

                    {aiDisclaimer && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-300">Match Note</p>
                                <p className="text-amber-200/90 text-xs mt-0.5">{aiDisclaimer}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Enhanced Search & Filter Controls */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    {isAIMode ? (
                        /* AI Search Bar */
                        <form onSubmit={handleAISubmit} className="relative flex items-center">
                            <div className={cn(
                                "relative flex items-center w-full bg-white/5 border rounded-2xl pr-2 transition-all shadow-sm",
                                "border-purple-500/60 ring-2 ring-purple-500/20 bg-purple-950/20 shadow-purple-950/30"
                            )}>
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 h-4 w-4 pointer-events-none" />
                                <input
                                    className="w-full bg-transparent border-none py-2.5 pl-10 pr-28 text-xs sm:text-sm text-white placeholder:text-gray-400 focus:outline-none"
                                    placeholder={actorName ? `Describe plot, vibe, or theme in ${actorName}'s work...` : "Describe plot, vibe, or theme..."}
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    disabled={isAILoading}
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isAILoading && (
                                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin mr-1" />
                                    )}
                                    {aiInput && !isAILoading && (
                                        <button
                                            type="button"
                                            onClick={() => setAiInput("")}
                                            className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                            title="Clear input"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => toggleAIMode(false)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40 border border-purple-500 transition-all shrink-0"
                                        title="Switch back to normal search"
                                    >
                                        <Bot className="w-3.5 h-3.5 text-white" />
                                        <span>AI Mode</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* Normal Title Search Bar */
                        <div className="relative flex items-center">
                            <div className="relative flex items-center w-full bg-white/5 border border-white/10 rounded-2xl pr-2 hover:border-white/20 transition-all focus-within:ring-2 focus-within:ring-white/20">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                                <input
                                    className="w-full bg-transparent border-none py-2.5 pl-10 pr-28 text-xs sm:text-sm text-white placeholder:text-gray-400 focus:outline-none"
                                    placeholder="Search titles..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                            title="Clear search"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {actorId && (
                                        <button
                                            type="button"
                                            onClick={() => toggleAIMode(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all shrink-0"
                                            title="Switch to AI Mode"
                                        >
                                            <Bot className="w-3.5 h-3.5" />
                                            <span>AI Mode</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Genre Selector */}
                <select
                    className="bg-white/5 border border-white/10 rounded-2xl py-2 px-3 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors [&>option]:bg-zinc-900"
                    onChange={(e) => {
                        setSelectedGenre(e.target.value);
                        setCurrentPage(1);
                    }}
                    value={selectedGenre}
                >
                    <option value="all">All Genres</option>
                    {availableGenres.map((genre) => (
                        <option key={genre.id} value={genre.id}>
                            {genre.name}
                        </option>
                    ))}
                </select>

                {/* Sort Selector */}
                <select
                    className="bg-white/5 border border-white/10 rounded-2xl py-2 px-3 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors [&>option]:bg-zinc-900"
                    onChange={(e) => {
                        setSortBy(e.target.value);
                        setCurrentPage(1);
                    }}
                    value={sortBy}
                >
                    {(hasActiveAI || isAISearchActive) && (
                        <option value="ai_match">Best AI Match</option>
                    )}
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filmography Grid */}
            {paginatedMovies.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {paginatedMovies.map((movie, index) => {
                            const key = `${getMediaType(movie)}:${movie.id}`;
                            const aiInfo = aiMatchesMap.get(key) || aiMatchesMap.get(`any:${movie.id}`);
                            return (
                                <MovieCard
                                    key={`${key}:${(movie as any).credit_id || index}`}
                                    movie={movie}
                                    matchScore={aiInfo?.match_score}
                                    aiReason={aiInfo?.reason}
                                    character={aiInfo?.character || (movie as any).character}
                                />
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages >= 1 && (
                        <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-white/10">
                            <button
                                onClick={() => handlePageChange(safeCurrentPage - 1)}
                                disabled={safeCurrentPage === 1}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors text-xs sm:text-sm"
                            >
                                Previous
                            </button>

                            <span className="text-gray-400 text-xs sm:text-sm">
                                Page <span className="text-white font-medium">{safeCurrentPage}</span> of <span className="text-white font-medium">{totalPages}</span>
                            </span>

                            <button
                                onClick={() => handlePageChange(safeCurrentPage + 1)}
                                disabled={safeCurrentPage === totalPages}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors text-xs sm:text-sm"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20 text-gray-500 text-sm">
                    {isAISearchActive
                        ? `No matching titles found for "${activeAIMood}". Try a broader plot or vibe description.`
                        : "No titles found matching your filters."}
                </div>
            )}
        </div>
    );
}
