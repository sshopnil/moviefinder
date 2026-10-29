"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { User, Users, Star, Clapperboard, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, Film, Layers } from "lucide-react";
import { Cast, CrewMember } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { getMovieCreditsAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";

interface MovieCastTabsProps {
    movieId: number;
    movieTitle?: string;
    cast: Cast[];
    crew?: CrewMember[];
}

export type MovieCastTabType = "all" | "top" | "key-crew" | "all-crew";

const DEPARTMENT_BADGE_STYLES: Record<string, string> = {
    Directing: "text-purple-300 bg-purple-500/10 border-purple-500/20",
    Writing: "text-indigo-300 bg-indigo-500/10 border-indigo-500/20",
    Production: "text-blue-300 bg-blue-500/10 border-blue-500/20",
    Sound: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    Camera: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    Editing: "text-teal-300 bg-teal-500/10 border-teal-500/20",
    Art: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    "Visual Effects": "text-violet-300 bg-violet-500/10 border-violet-500/20",
    "Costume & Make-Up": "text-pink-300 bg-pink-500/10 border-pink-500/20",
};

export function MovieCastTabs({
    movieId,
    movieTitle,
    cast: initialCast,
    crew: initialCrew = [],
}: MovieCastTabsProps) {
    const [cast, setCast] = useState<Cast[]>(initialCast || []);
    const [crew, setCrew] = useState<CrewMember[]>(initialCrew || []);
    const [isFetchingCredits, setIsFetchingCredits] = useState(false);

    // Sync state when props update
    useEffect(() => {
        setCast(initialCast || []);
    }, [initialCast]);

    useEffect(() => {
        setCrew(initialCrew || []);
    }, [initialCrew]);

    // Resiliency: if initial props have 0 cast and 0 crew, attempt fallback fetch from server action
    useEffect(() => {
        if ((!initialCast || initialCast.length === 0) && (!initialCrew || initialCrew.length === 0) && Number.isFinite(movieId)) {
            setIsFetchingCredits(true);
            getMovieCreditsAction(movieId)
                .then((credits) => {
                    if (credits.cast && credits.cast.length > 0) setCast(credits.cast);
                    if (credits.crew && credits.crew.length > 0) setCrew(credits.crew);
                })
                .catch(() => {})
                .finally(() => setIsFetchingCredits(false));
        }
    }, [movieId, initialCast, initialCrew]);

    // Derive top-billed cast (order < 15 or top 15 entries)
    const topCast = useMemo(() => {
        if (!Array.isArray(cast)) return [];
        return cast.slice(0, Math.min(cast.length, 15));
    }, [cast]);

    // Derive key creative crew (priority <= 9: directors, writers, producers, DP, editors, composers, heads)
    const keyCrew = useMemo(() => {
        if (!Array.isArray(crew)) return [];
        return crew.filter((member) => member.priority !== undefined && member.priority <= 9);
    }, [crew]);

    // Choose default tab: if no cast but crew exists, default to crew
    const defaultTab: MovieCastTabType = cast.length > 0
        ? "all"
        : (keyCrew.length > 0 ? "key-crew" : (crew.length > 0 ? "all-crew" : "all"));

    const [activeTab, setActiveTab] = useState<MovieCastTabType>(defaultTab);
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const tabsScroll = useHorizontalScroll({ scrollFactor: 0.65, minScrollDistance: 150 });
    const tabListRef = tabsScroll.containerRef;
    const deptScroll = useHorizontalScroll({ scrollFactor: 0.65, minScrollDistance: 150 });

    const isCrewTab = activeTab === "key-crew" || activeTab === "all-crew";
    const currentCrewPool = activeTab === "key-crew" ? keyCrew : crew;

    // Available departments for the currently active crew pool
    const availableDepartments = useMemo(() => {
        if (!isCrewTab) return [];
        const deptCounts = new Map<string, number>();
        for (const member of currentCrewPool) {
            const dept = member.department?.trim();
            if (dept) {
                deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
            }
        }
        return Array.from(deptCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [isCrewTab, currentCrewPool]);

    // Handle tab change: reset expand state and department filter without persistent min-height lock
    const handleTabChange = useCallback((tab: MovieCastTabType) => {
        setActiveTab(tab);
        setSelectedDepartment("all");
        setIsExpanded(false);
        setTimeout(() => {
            tabsScroll.updateScrollState();
            deptScroll.updateScrollState();
        }, 150);
    }, [tabsScroll, deptScroll]);

    // Active base list depending on selected tab & department
    const baseList = useMemo(() => {
        if (activeTab === "top") return topCast;
        if (activeTab === "key-crew") {
            if (selectedDepartment === "all") return keyCrew;
            return keyCrew.filter((m) => m.department === selectedDepartment);
        }
        if (activeTab === "all-crew") {
            if (selectedDepartment === "all") return crew;
            return crew.filter((m) => m.department === selectedDepartment);
        }
        return cast;
    }, [activeTab, cast, topCast, keyCrew, crew, selectedDepartment]);

    // Live search query
    const query = searchQuery.trim().toLowerCase();
    const isSearching = query.length > 0;

    // Filter list: when searching in cast tabs, search across the entire cast so non-top-15 are not missed
    const filteredList = useMemo(() => {
        if (!query) return baseList;

        if (isCrewTab) {
            return (baseList as CrewMember[]).filter((item) => {
                const nameMatch = item.name?.toLowerCase().includes(query);
                const jobMatch = item.job?.toLowerCase().includes(query);
                const deptMatch = item.department?.toLowerCase().includes(query);
                return nameMatch || jobMatch || deptMatch;
            });
        }

        // For cast tabs: if searching, search the entire cast
        const pool = cast;
        return pool.filter((item) => {
            const nameMatch = item.name?.toLowerCase().includes(query);
            const charMatch = item.character?.toLowerCase().includes(query);
            return nameMatch || charMatch;
        });
    }, [baseList, query, isCrewTab, cast]);

    // Cross-category search discovery counts: allows suggesting the other category when 0 results found
    const crossCategoryMatches = useMemo(() => {
        if (!isSearching) return { castCount: 0, crewCount: 0 };
        const castCount = cast.filter(
            (c) => c.name?.toLowerCase().includes(query) || c.character?.toLowerCase().includes(query)
        ).length;
        const crewCount = crew.filter(
            (c) =>
                c.name?.toLowerCase().includes(query) ||
                c.job?.toLowerCase().includes(query) ||
                c.department?.toLowerCase().includes(query)
        ).length;
        return { castCount, crewCount };
    }, [isSearching, query, cast, crew]);

    // Handle expand / collapse with smooth scroll back to cast section
    const handleToggleExpand = useCallback(() => {
        if (isExpanded) {
            const castElement = document.getElementById("cast");
            if (castElement) {
                castElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
        setIsExpanded((prev) => !prev);
    }, [isExpanded]);

    // Keyboard navigation for W3C ARIA APG Tabs
    const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
        const tabButtons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        if (!tabButtons || tabButtons.length === 0) return;

        let nextIndex = index;
        if (e.key === "ArrowRight") {
            e.preventDefault();
            nextIndex = (index + 1) % tabButtons.length;
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        } else if (e.key === "Home") {
            e.preventDefault();
            nextIndex = 0;
        } else if (e.key === "End") {
            e.preventDefault();
            nextIndex = tabButtons.length - 1;
        }

        if (nextIndex !== index) {
            tabButtons[nextIndex]?.focus();
            tabButtons[nextIndex]?.click();
        }
    };

    const INITIAL_DISPLAY_COUNT = 20;
    const hasMore = !isSearching && filteredList.length > 24;
    const displayedItems = isExpanded || !hasMore || isSearching
        ? filteredList
        : filteredList.slice(0, INITIAL_DISPLAY_COUNT);

    const totalCastCount = cast.length;
    const totalCrewCount = crew.length;
    const totalKeyCrewCount = keyCrew.length;

    // Determine available tabs
    const showTopBilledTab = totalCastCount > 8;
    const showKeyCrewTab = totalKeyCrewCount > 0;
    const showAllCrewTab = totalCrewCount > 0 && (totalCrewCount !== totalKeyCrewCount || totalKeyCrewCount === 0);

    // If both cast and crew are empty, and not loading
    if (totalCastCount === 0 && totalCrewCount === 0 && !isFetchingCredits) {
        return null;
    }

    return (
        <div id="cast" className="space-y-4 pt-4 border-t border-white/10 scroll-mt-20">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400 shrink-0" />
                    <h3 className="text-lg font-semibold text-white">
                        {isCrewTab ? "Movie Crew & Production" : "Cast & Characters"}
                    </h3>
                </div>

                {/* Live Search Filter */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isCrewTab ? "Search crew, role, dept..." : "Search cast or character..."}
                        aria-label="Filter cast and crew by name, character, or department"
                        className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-full pl-8 pr-8 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search filter"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-400"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Category Tabs */}
            <div className="relative group/tabs flex items-center min-w-0 max-w-full">
                {/* Left scroll arrow */}
                <div
                    className={cn(
                        "absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 pl-0.5 bg-gradient-to-r from-background via-background/90 to-transparent transition-opacity duration-200 pointer-events-none",
                        tabsScroll.canScrollLeft ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                    )}
                >
                    <button
                        type="button"
                        onClick={tabsScroll.scrollLeft}
                        disabled={!tabsScroll.canScrollLeft}
                        aria-hidden={!tabsScroll.canScrollLeft}
                        tabIndex={tabsScroll.canScrollLeft ? 0 : -1}
                        aria-label="Scroll tabs left"
                        className={cn(
                            "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                            tabsScroll.canScrollLeft ? "pointer-events-auto" : "pointer-events-none"
                        )}
                    >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                </div>

                <div
                    ref={tabListRef}
                    role="tablist"
                    aria-label="Movie cast and crew categories"
                    className="relative flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 max-w-full touch-pan-x px-6 sm:px-8 cursor-grab active:cursor-grabbing"
                >
                    {/* Tab: All Cast */}
                    {totalCastCount > 0 && (
                        <button
                            type="button"
                            role="tab"
                            id="tab-all-cast"
                            tabIndex={activeTab === "all" ? 0 : -1}
                            aria-selected={activeTab === "all"}
                            aria-controls="movie-cast-grid-panel"
                            onClick={() => handleTabChange("all")}
                            onKeyDown={(e) => handleTabKeyDown(e, 0)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                activeTab === "all"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <Users className="w-3 h-3" />
                            <span>All Cast</span>
                        </button>
                    )}

                    {/* Tab: Top Billed */}
                    {showTopBilledTab && (
                        <button
                            type="button"
                            role="tab"
                            id="tab-top-billed"
                            tabIndex={activeTab === "top" ? 0 : -1}
                            aria-selected={activeTab === "top"}
                            aria-controls="movie-cast-grid-panel"
                            onClick={() => handleTabChange("top")}
                            onKeyDown={(e) => handleTabKeyDown(e, 1)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                activeTab === "top"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <Star className="w-3 h-3" />
                            <span>Top Billed</span>
                        </button>
                    )}

                    {/* Tab: Key Crew */}
                    {showKeyCrewTab && (
                        <button
                            type="button"
                            role="tab"
                            id="tab-key-crew"
                            tabIndex={activeTab === "key-crew" ? 0 : -1}
                            aria-selected={activeTab === "key-crew"}
                            aria-controls="movie-cast-grid-panel"
                            onClick={() => handleTabChange("key-crew")}
                            onKeyDown={(e) => handleTabKeyDown(e, showTopBilledTab ? 2 : 1)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                activeTab === "key-crew"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <Clapperboard className="w-3 h-3" />
                            <span>Key Crew</span>
                        </button>
                    )}

                    {/* Tab: All Crew */}
                    {showAllCrewTab && (
                        <button
                            type="button"
                            role="tab"
                            id="tab-all-crew"
                            tabIndex={activeTab === "all-crew" ? 0 : -1}
                            aria-selected={activeTab === "all-crew"}
                            aria-controls="movie-cast-grid-panel"
                            onClick={() => handleTabChange("all-crew")}
                            onKeyDown={(e) => handleTabKeyDown(e, (showTopBilledTab ? 1 : 0) + (showKeyCrewTab ? 1 : 0) + 1)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                activeTab === "all-crew"
                                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <Layers className="w-3 h-3" />
                            <span>All Crew</span>
                        </button>
                    )}
                </div>

                {/* Right scroll arrow */}
                <div
                    className={cn(
                        "absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 pr-0.5 bg-gradient-to-l from-background via-background/90 to-transparent transition-opacity duration-200 pointer-events-none",
                        tabsScroll.canScrollRight ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                    )}
                >
                    <button
                        type="button"
                        onClick={tabsScroll.scrollRight}
                        disabled={!tabsScroll.canScrollRight}
                        aria-hidden={!tabsScroll.canScrollRight}
                        tabIndex={tabsScroll.canScrollRight ? 0 : -1}
                        aria-label="Scroll tabs right"
                        className={cn(
                            "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                            tabsScroll.canScrollRight ? "pointer-events-auto" : "pointer-events-none"
                        )}
                    >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                </div>
            </div>

            {/* Crew Department Filter Pills (displayed when viewing Key Crew or All Crew) */}
            {isCrewTab && availableDepartments.length > 1 && (
                <div className="relative group/depts flex items-center min-w-0 max-w-full">
                    {/* Left scroll arrow */}
                    <div
                        className={cn(
                            "absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 pl-0.5 bg-gradient-to-r from-background via-background/90 to-transparent transition-opacity duration-200 pointer-events-none",
                            deptScroll.canScrollLeft ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                        )}
                    >
                        <button
                            type="button"
                            onClick={deptScroll.scrollLeft}
                            disabled={!deptScroll.canScrollLeft}
                            aria-hidden={!deptScroll.canScrollLeft}
                            tabIndex={deptScroll.canScrollLeft ? 0 : -1}
                            aria-label="Scroll departments left"
                            className={cn(
                                "flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                deptScroll.canScrollLeft ? "pointer-events-auto" : "pointer-events-none"
                            )}
                        >
                            <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                    </div>

                    <div
                        ref={deptScroll.containerRef}
                        role="group"
                        aria-label="Filter crew by department"
                        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 text-xs touch-pan-x px-6 sm:px-8 cursor-grab active:cursor-grabbing"
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedDepartment("all")}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                selectedDepartment === "all"
                                    ? "bg-white/20 text-white border-white/30"
                                    : "bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10"
                            )}
                        >
                            All Departments
                        </button>
                        {availableDepartments.map(({ name }) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setSelectedDepartment(name)}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                    selectedDepartment === name
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                        : "bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {name}
                            </button>
                        ))}
                    </div>

                    {/* Right scroll arrow */}
                    <div
                        className={cn(
                            "absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 pr-0.5 bg-gradient-to-l from-background via-background/90 to-transparent transition-opacity duration-200 pointer-events-none",
                            deptScroll.canScrollRight ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                        )}
                    >
                        <button
                            type="button"
                            onClick={deptScroll.scrollRight}
                            disabled={!deptScroll.canScrollRight}
                            aria-hidden={!deptScroll.canScrollRight}
                            tabIndex={deptScroll.canScrollRight ? 0 : -1}
                            aria-label="Scroll departments right"
                            className={cn(
                                "flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                deptScroll.canScrollRight ? "pointer-events-auto" : "pointer-events-none"
                            )}
                        >
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Panel */}
            <div
                id="movie-cast-grid-panel"
                role="tabpanel"
                aria-labelledby={
                    activeTab === "all"
                        ? "tab-all-cast"
                        : activeTab === "top"
                        ? "tab-top-billed"
                        : activeTab === "key-crew"
                        ? "tab-key-crew"
                        : "tab-all-crew"
                }
                tabIndex={0}
                className="relative transition-all duration-300 min-h-[220px] focus-visible:outline-none"
            >
                {displayedItems.length === 0 ? (
                    <div className="text-center py-14 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-400 text-xs sm:text-sm flex flex-col items-center justify-center space-y-3 px-4">
                        <Users className="w-8 h-8 text-gray-500 opacity-50 mb-0.5" />
                        {isSearching ? (
                            <div className="space-y-2 text-center max-w-md">
                                <p>No {isCrewTab ? "crew members" : "cast"} found matching &ldquo;{searchQuery}&rdquo;.</p>

                                {/* Cross-category discovery helper */}
                                {isCrewTab && crossCategoryMatches.castCount > 0 && (
                                    <p className="text-xs text-gray-300">
                                        Found <span className="text-purple-400 font-semibold">{crossCategoryMatches.castCount}</span> matching {crossCategoryMatches.castCount === 1 ? "actor" : "actors"} in Cast.{" "}
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("all")}
                                            className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 ml-1 cursor-pointer focus-visible:outline-none"
                                        >
                                            Switch to Cast
                                        </button>
                                    </p>
                                )}

                                {!isCrewTab && crossCategoryMatches.crewCount > 0 && (
                                    <p className="text-xs text-gray-300">
                                        Found <span className="text-purple-400 font-semibold">{crossCategoryMatches.crewCount}</span> matching {crossCategoryMatches.crewCount === 1 ? "member" : "members"} in Crew.{" "}
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("key-crew")}
                                            className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 ml-1 cursor-pointer focus-visible:outline-none"
                                        >
                                            Switch to Crew
                                        </button>
                                    </p>
                                )}

                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="text-xs text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 cursor-pointer"
                                    >
                                        Clear search filter
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p>No {isCrewTab ? "crew" : "cast"} information available for this movie.</p>
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                            {displayedItems.map((person, idx) => {
                                const isCrew = "job" in person;
                                const subtitle = isCrew
                                    ? (person as CrewMember).job
                                    : (person as Cast).character;
                                const department = isCrew ? (person as CrewMember).department : undefined;
                                const order = !isCrew ? (person as Cast).order : undefined;
                                const hasOrder = typeof order === "number";

                                // Determine top-billed badge text
                                let billingBadgeText: string | null = null;
                                if (!isCrew && hasOrder) {
                                    if (order === 0) {
                                        billingBadgeText = "Lead Star";
                                    } else if (order < 3) {
                                        billingBadgeText = "Leading Cast";
                                    }
                                }

                                const badgeStyle = department
                                    ? DEPARTMENT_BADGE_STYLES[department] || "text-purple-300 bg-purple-500/10 border-purple-500/20"
                                    : undefined;

                                return (
                                    <Link
                                        key={`${person.id}-${subtitle || idx}`}
                                        href={`/person/${person.id}`}
                                        prefetch={false}
                                        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-2xl"
                                    >
                                        <article className="h-full p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/30 transition-all duration-200 text-center flex flex-col items-center shadow-sm hover:shadow-md hover:shadow-purple-950/20 hover:-translate-y-0.5">
                                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2.5 bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-purple-400/50 transition-all shrink-0">
                                                {person.profile_path ? (
                                                    <Image
                                                        src={TMDB_IMAGE_URL.profile(person.profile_path)}
                                                        alt={person.name}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                        sizes="96px"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-500">
                                                        <User className="w-8 h-8 opacity-40" />
                                                    </div>
                                                )}
                                            </div>

                                            <p
                                                className="text-xs sm:text-sm font-semibold text-white truncate max-w-full group-hover:text-purple-300 transition-colors"
                                                title={person.name}
                                            >
                                                {person.name}
                                            </p>

                                            {subtitle && (
                                                <p
                                                    className="text-[11px] text-gray-400 truncate max-w-full mt-0.5"
                                                    title={subtitle}
                                                >
                                                    {subtitle}
                                                </p>
                                            )}

                                            {isCrew && department && (
                                                <span
                                                    className={cn(
                                                        "mt-1.5 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-full border",
                                                        badgeStyle
                                                    )}
                                                >
                                                    {department}
                                                </span>
                                            )}

                                            {billingBadgeText && (
                                                <span className="mt-1.5 inline-block text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full truncate max-w-full">
                                                    {billingBadgeText}
                                                </span>
                                            )}
                                        </article>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Expand / Collapse Button if list is large and not actively searching */}
                        {hasMore && (
                            <div className="flex justify-center pt-5">
                                <button
                                    type="button"
                                    onClick={handleToggleExpand}
                                    aria-expanded={isExpanded}
                                    aria-controls="movie-cast-grid-panel"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all shadow-sm cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                >
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp className="w-3.5 h-3.5" />
                                            <span>Show Less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-3.5 h-3.5" />
                                            <span>Show All</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export { MovieCastTabs as MovieCastSection };
