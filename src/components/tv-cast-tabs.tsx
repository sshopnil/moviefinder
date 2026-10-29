"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { User, Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Layers, Check, Loader2, Film } from "lucide-react";
import { Cast, Season } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { getTVSeasonCreditsAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";

interface TVCastTabsProps {
    tvId: number;
    allCast: Cast[];
    seasons: Season[];
    initialSeason?: number;
    initialSeasonCast?: Cast[];
    showSeasonsRow?: boolean;
}

export function TVCastTabs({
    tvId,
    allCast,
    seasons,
    initialSeason,
    initialSeasonCast,
    showSeasonsRow = true,
}: TVCastTabsProps) {
    const hasInitialSeason = initialSeason !== undefined && seasons.some((s) => s.season_number === initialSeason);
    const [activeTab, setActiveTab] = useState<"all" | number>(hasInitialSeason ? (initialSeason as number) : "all");
    const [seasonCastCache, setSeasonCastCache] = useState<Record<number, Cast[]>>(() => {
        if (hasInitialSeason && initialSeasonCast) {
            return { [initialSeason as number]: initialSeasonCast };
        }
        return {};
    });
    const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const fetchingSeasonsRef = useRef<Set<number>>(new Set());
    const prevInitialSeasonRef = useRef<number | undefined>(initialSeason);
    const seasonsScroll = useHorizontalScroll({ scrollFactor: 0.75, minScrollDistance: 200 });
    const tabsScroll = useHorizontalScroll({ scrollFactor: 0.65, minScrollDistance: 150 });
    const tabsListRef = tabsScroll.containerRef;
    const seasonsRowRef = seasonsScroll.containerRef;
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const minContentHeightRef = useRef<number>(360);

    // Sort valid regular seasons (season_number > 0)
    const regularSeasons = seasons
        .filter((s) => s.season_number > 0)
        .sort((a, b) => a.season_number - b.season_number);

    // Optional specials season (season 0) if it has episodes
    const specialsSeason = seasons.find((s) => s.season_number === 0 && (s.episode_count || 0) > 0);

    const orderedSeasons = specialsSeason
        ? [...regularSeasons, specialsSeason]
        : regularSeasons;

    // Fetch season cast via server action without triggering page navigation
    const fetchSeasonCast = useCallback(async (seasonNum: number) => {
        if (seasonCastCache[seasonNum] !== undefined || fetchingSeasonsRef.current.has(seasonNum)) {
            return;
        }

        fetchingSeasonsRef.current.add(seasonNum);
        setLoadingSeason(seasonNum);

        try {
            const cast = await getTVSeasonCreditsAction(tvId, seasonNum);
            setSeasonCastCache((prev) => ({
                ...prev,
                [seasonNum]: cast,
            }));
        } catch (error) {
            console.error(`Failed to load season ${seasonNum} credits:`, error);
            setSeasonCastCache((prev) => ({
                ...prev,
                [seasonNum]: [],
            }));
        } finally {
            fetchingSeasonsRef.current.delete(seasonNum);
            setLoadingSeason((current) => (current === seasonNum ? null : current));
        }
    }, [seasonCastCache, tvId]);

    // Prefetch season cast on hover for instantaneous tab switching
    const prefetchSeasonCast = useCallback((seasonNum: number) => {
        if (seasonCastCache[seasonNum] !== undefined || fetchingSeasonsRef.current.has(seasonNum)) {
            return;
        }
        fetchingSeasonsRef.current.add(seasonNum);
        getTVSeasonCreditsAction(tvId, seasonNum)
            .then((cast) => {
                setSeasonCastCache((prev) => ({ ...prev, [seasonNum]: cast }));
            })
            .catch(() => {})
            .finally(() => {
                fetchingSeasonsRef.current.delete(seasonNum);
            });
    }, [seasonCastCache, tvId]);

    // Update URL silently without triggering Next.js router re-render or scrolling to top
    const updateUrlSilently = useCallback((tab: "all" | number) => {
        if (typeof window === "undefined") return;
        try {
            const currentUrl = new URL(window.location.href);
            if (tab === "all") {
                currentUrl.searchParams.delete("season");
            } else {
                currentUrl.searchParams.set("season", tab.toString());
            }
            // Passing __NA: true in history state instructs Next.js App Router's
            // monkeypatched replaceState to bypass applyUrlFromHistoryPushReplace,
            // preventing full-page server component re-renders, loading.tsx skeletons, and scroll resets.
            const nextState = {
                ...(window.history.state || {}),
                __NA: true,
            };
            window.history.replaceState(nextState, "", currentUrl.toString());
        } catch {
            // Ignore URL update errors in non-browser environments
        }
    }, []);

    // Tab change handler
    const handleTabChange = useCallback((tab: "all" | number) => {
        // Record current grid height before switching to prevent layout collapse
        if (gridContainerRef.current) {
            const currentH = gridContainerRef.current.offsetHeight;
            if (currentH > 200) {
                minContentHeightRef.current = currentH;
            }
        }

        setActiveTab(tab);
        setIsExpanded(false);
        updateUrlSilently(tab);

        if (tab !== "all") {
            fetchSeasonCast(tab);
        }
    }, [updateUrlSilently, fetchSeasonCast]);

    // Handler for clicking a season card in All Seasons
    const handleSeasonCardClick = useCallback((seasonNumber: number, e?: React.MouseEvent) => {
        if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)) {
            return; // Allow native middle click / open in new tab
        }
        if (e) {
            e.preventDefault();
        }

        handleTabChange(seasonNumber);

        // Smoothly scroll down to the Cast section
        if (typeof document !== "undefined") {
            const castElement = document.getElementById("cast");
            if (castElement) {
                castElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    }, [handleTabChange]);

    // Handler for clicking "View All Cast" from the seasons carousel
    const handleViewAllCastClick = useCallback((e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
        }
        handleTabChange("all");
        if (typeof document !== "undefined") {
            const castElement = document.getElementById("cast");
            if (castElement) {
                castElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    }, [handleTabChange]);

    // Handler for expanding / collapsing the cast list
    const handleToggleExpand = useCallback(() => {
        if (isExpanded) {
            // Smoothly scroll back to top of cast section when collapsing so user is not stranded
            const castElement = document.getElementById("cast");
            if (castElement) {
                castElement.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
        setIsExpanded((prev) => !prev);
    }, [isExpanded]);

    // Sync only when initialSeason prop updates externally (e.g. full URL change)
    useEffect(() => {
        if (initialSeason !== prevInitialSeasonRef.current) {
            prevInitialSeasonRef.current = initialSeason;
            if (initialSeason !== undefined && seasons.some((s) => s.season_number === initialSeason)) {
                setActiveTab(initialSeason);
                setIsExpanded(false);
                fetchSeasonCast(initialSeason);
            }
        }
    }, [initialSeason, seasons, fetchSeasonCast]);

    // Automatically fetch season cast if initialized on a season that is not yet cached
    useEffect(() => {
        if (typeof activeTab === "number" && seasonCastCache[activeTab] === undefined) {
            fetchSeasonCast(activeTab);
        }
    }, [activeTab, fetchSeasonCast, seasonCastCache]);

    // Sync active tab when user navigates using browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const seasonParam = params.get("season");
                if (seasonParam !== null) {
                    const seasonNum = parseInt(seasonParam, 10);
                    if (Number.isFinite(seasonNum) && seasons.some((s) => s.season_number === seasonNum)) {
                        setActiveTab(seasonNum);
                        setIsExpanded(false);
                        fetchSeasonCast(seasonNum);
                        return;
                    }
                }
                setActiveTab("all");
                setIsExpanded(false);
            } catch {
                // Ignore popstate errors
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [seasons, fetchSeasonCast]);

    const updateTabsScrollState = tabsScroll.updateScrollState;
    const updateSeasonsScrollState = seasonsScroll.updateScrollState;

    // Center active tab pill horizontally within the tab bar only when activeTab changes
    useEffect(() => {
        if (tabsListRef.current) {
            const activeBtn = tabsListRef.current.querySelector<HTMLElement>('[data-active="true"]');
            if (activeBtn) {
                const container = tabsListRef.current;
                const containerRect = container.getBoundingClientRect();
                const itemRect = activeBtn.getBoundingClientRect();
                const relativeLeft = itemRect.left - containerRect.left + container.scrollLeft;
                const targetLeft = relativeLeft - (container.clientWidth / 2) + (itemRect.width / 2);
                container.scrollTo({
                    left: Math.max(0, targetLeft),
                    behavior: "smooth",
                });
            }
        }
        const timer = setTimeout(() => {
            updateTabsScrollState();
        }, 350);
        return () => clearTimeout(timer);
    }, [activeTab, updateTabsScrollState]);

    // Center active season card horizontally within the seasons carousel only when activeTab changes
    useEffect(() => {
        if (seasonsRowRef.current && typeof activeTab === "number") {
            const activeCard = seasonsRowRef.current.querySelector<HTMLElement>('[data-active-card="true"]');
            if (activeCard) {
                const container = seasonsRowRef.current;
                const containerRect = container.getBoundingClientRect();
                const itemRect = activeCard.getBoundingClientRect();
                const relativeLeft = itemRect.left - containerRect.left + container.scrollLeft;
                const targetLeft = relativeLeft - (container.clientWidth / 2) + (itemRect.width / 2);
                container.scrollTo({
                    left: Math.max(0, targetLeft),
                    behavior: "smooth",
                });
            }
        }
        const timer = setTimeout(() => {
            updateSeasonsScrollState();
        }, 350);
        return () => clearTimeout(timer);
    }, [activeTab, updateSeasonsScrollState]);

    const isSeasonDataPending = typeof activeTab === "number" && seasonCastCache[activeTab] === undefined;
    const isLoading = isSeasonDataPending || (loadingSeason !== null && activeTab === loadingSeason);
    const currentCast = activeTab === "all" ? allCast : (seasonCastCache[activeTab] || []);

    const INITIAL_DISPLAY_COUNT = 20;
    // If the cast has 24 or fewer members, show them all immediately without requiring an expand click
    const hasMore = currentCast.length > 24;
    const displayedCast = isExpanded || !hasMore ? currentCast : currentCast.slice(0, INITIAL_DISPLAY_COUNT);

    const seasonLabel = activeTab === "all" ? "this series" : activeTab === 0 ? "Specials" : `Season ${activeTab}`;

    return (
        <div className="space-y-6">
            {/* Horizontal All Seasons Carousel */}
            {showSeasonsRow && orderedSeasons.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Film className="w-5 h-5 text-purple-400" />
                            <h3 className="text-lg font-semibold text-white">
                                {orderedSeasons.length > 1 ? "All Seasons" : "Seasons"}
                            </h3>
                        </div>
                        {orderedSeasons.length > 1 && activeTab !== "all" && (
                            <button
                                type="button"
                                onClick={handleViewAllCastClick}
                                className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:underline"
                            >
                                <span>View All Cast</span>
                            </button>
                        )}
                    </div>

                    <div className="relative group/carousel">
                        {/* Left scroll arrow */}
                        <div
                            className={cn(
                                "absolute left-0 top-0 h-[210px] sm:h-[225px] z-20 flex items-center pr-5 pl-1 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity duration-200 pointer-events-none",
                                seasonsScroll.canScrollLeft ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                            )}
                        >
                            <button
                                type="button"
                                onClick={seasonsScroll.scrollLeft}
                                disabled={!seasonsScroll.canScrollLeft}
                                aria-hidden={!seasonsScroll.canScrollLeft}
                                tabIndex={seasonsScroll.canScrollLeft ? 0 : -1}
                                aria-label="Scroll seasons left"
                                className={cn(
                                    "flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-xl backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                    seasonsScroll.canScrollLeft ? "pointer-events-auto" : "pointer-events-none"
                                )}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        </div>

                        <div
                            ref={seasonsRowRef}
                            className="relative flex gap-4 overflow-x-auto pb-4 px-2 sm:px-4 scrollbar-hide touch-pan-x select-none cursor-grab active:cursor-grabbing"
                        >
                            {orderedSeasons.map((season) => {
                                const isSelected = activeTab === season.season_number;
                                return (
                                    <a
                                        key={season.id || `season-card-${season.season_number}`}
                                        href={`/tv/${tvId}?season=${season.season_number}#cast`}
                                        data-active-card={isSelected ? "true" : undefined}
                                        onClick={(e) => handleSeasonCardClick(season.season_number, e)}
                                        onMouseEnter={() => prefetchSeasonCast(season.season_number)}
                                        className="min-w-[140px] sm:min-w-[150px] space-y-2 group block cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 outline-none focus:outline-none focus-visible:outline-none"
                                    >
                                        <div
                                            className={cn(
                                                "relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-white/5 border-2 transition-all duration-200",
                                                isSelected && orderedSeasons.length > 1
                                                    ? "border-purple-500"
                                                    : "border-white/10 group-hover:border-purple-400/50 group-focus-visible:border-purple-400"
                                            )}
                                        >
                                            {season.poster_path ? (
                                                <Image
                                                    src={TMDB_IMAGE_URL.poster(season.poster_path)}
                                                    alt={season.name}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                    sizes="(max-width: 640px) 140px, 150px"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 text-center p-3 bg-gradient-to-b from-white/5 to-white/[0.02]">
                                                    <Film className="w-6 h-6 mb-1 text-gray-600 opacity-60" />
                                                    <span className="line-clamp-2">{season.name}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p
                                                className={cn(
                                                    "text-sm font-medium truncate transition-colors",
                                                    isSelected && orderedSeasons.length > 1
                                                        ? "text-purple-300 font-semibold"
                                                        : "text-white group-hover:text-purple-300"
                                                )}
                                            >
                                                {season.name}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {season.episode_count || 0} {season.episode_count === 1 ? "Episode" : "Episodes"}
                                            </p>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>

                        {/* Right scroll arrow */}
                        <div
                            className={cn(
                                "absolute right-0 top-0 h-[210px] sm:h-[225px] z-20 flex items-center pl-5 pr-1 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity duration-200 pointer-events-none",
                                seasonsScroll.canScrollRight ? "opacity-100 visible" : "opacity-0 pointer-events-none invisible"
                            )}
                        >
                            <button
                                type="button"
                                onClick={seasonsScroll.scrollRight}
                                disabled={!seasonsScroll.canScrollRight}
                                aria-hidden={!seasonsScroll.canScrollRight}
                                tabIndex={seasonsScroll.canScrollRight ? 0 : -1}
                                aria-label="Scroll seasons right"
                                className={cn(
                                    "flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-xl backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                    seasonsScroll.canScrollRight ? "pointer-events-auto" : "pointer-events-none"
                                )}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Series Cast & Characters Section */}
            <div id="cast" className="space-y-4 pt-4 border-t border-white/10 scroll-mt-20">
                {/* Header & Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-semibold text-white">
                            Series Cast & Characters
                        </h3>
                    </div>

                    {/* Season Tabs List (Only needed when series has multiple seasons) */}
                    {orderedSeasons.length > 1 && (
                        <div className="relative group/tabs flex items-center min-w-0 max-w-full sm:max-w-[65%] lg:max-w-[72%]">
                            {/* Left tab scroll arrow */}
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
                                    aria-label="Scroll season tabs left"
                                    className={cn(
                                        "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                        tabsScroll.canScrollLeft ? "pointer-events-auto" : "pointer-events-none"
                                    )}
                                >
                                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                            </div>

                            <div
                                ref={tabsListRef}
                                role="tablist"
                                aria-label="Cast by Season"
                                className="relative flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 max-w-full touch-pan-x px-6 sm:px-8 cursor-grab active:cursor-grabbing"
                            >
                                {/* Tab: All Cast */}
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === "all"}
                                    aria-controls="cast-grid-panel"
                                    data-active={activeTab === "all" ? "true" : undefined}
                                    onClick={() => handleTabChange("all")}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                        activeTab === "all"
                                            ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <Layers className="w-3 h-3" />
                                    <span>All Cast</span>
                                </button>

                                {/* Season Tabs */}
                                {orderedSeasons.map((s) => {
                                    const isCurrent = activeTab === s.season_number;
                                    const isThisSeasonLoading = loadingSeason === s.season_number;
                                    const label = s.season_number === 0 ? "Specials" : `Season ${s.season_number}`;

                                    return (
                                        <button
                                            key={s.id || `season-${s.season_number}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={isCurrent}
                                            aria-controls="cast-grid-panel"
                                            data-active={isCurrent ? "true" : undefined}
                                            onClick={() => handleTabChange(s.season_number)}
                                            onMouseEnter={() => prefetchSeasonCast(s.season_number)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                                isCurrent
                                                    ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
                                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            {isThisSeasonLoading && (
                                                <Loader2 className="w-3 h-3 animate-spin text-purple-200" />
                                            )}
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right tab scroll arrow */}
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
                                    aria-label="Scroll season tabs right"
                                    className={cn(
                                        "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/80 hover:bg-black active:scale-95 text-white border border-white/20 shadow-md backdrop-blur-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                        tabsScroll.canScrollRight ? "pointer-events-auto" : "pointer-events-none"
                                    )}
                                >
                                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Cast Grid Container - Preserves height during transitions to eliminate layout shifts */}
                <div
                    id="cast-grid-panel"
                    role="tabpanel"
                    ref={gridContainerRef}
                    style={{ minHeight: `${minContentHeightRef.current}px` }}
                    className="relative transition-all duration-300"
                >
                    {isLoading && currentCast.length === 0 ? (
                        /* Skeleton Loader when initial season data is fetching without prior cache */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4 animate-pulse">
                            {Array.from({ length: 10 }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className="text-center p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 flex flex-col items-center"
                                >
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10 mx-auto" />
                                    <div className="h-3.5 bg-white/10 rounded w-3/4 mx-auto" />
                                    <div className="h-3 bg-white/5 rounded w-1/2 mx-auto" />
                                    <div className="h-2.5 bg-purple-500/10 rounded w-1/3 mx-auto" />
                                </div>
                            ))}
                        </div>
                    ) : currentCast.length === 0 && !isLoading ? (
                        /* Empty state */
                        <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5 text-gray-400 text-xs sm:text-sm flex flex-col items-center justify-center space-y-2">
                            <Users className="w-8 h-8 text-gray-500 opacity-50 mb-1" />
                            <p>No cast information found for {seasonLabel}.</p>
                        </div>
                    ) : (
                        <div className={cn("transition-opacity duration-200", isLoading ? "opacity-50 pointer-events-none" : "opacity-100")}>
                            {/* Loading overlay spinner when switching between seasons */}
                            {isLoading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/60 backdrop-blur-sm border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
                                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                        <span className="text-xs text-white font-medium">Loading {seasonLabel}...</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                                {displayedCast.map((actor, idx) => (
                                    <Link
                                        key={`${actor.id}-${actor.character || idx}`}
                                        href={`/person/${actor.id}`}
                                        prefetch={false}
                                        className="group p-3 sm:p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/30 transition-all duration-200 text-center flex flex-col items-center shadow-sm hover:shadow-md hover:shadow-purple-950/20 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                    >
                                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2.5 bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-purple-400/50 transition-all shrink-0">
                                            {actor.profile_path ? (
                                                <Image
                                                    src={TMDB_IMAGE_URL.profile(actor.profile_path)}
                                                    alt={actor.name}
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
                                            title={actor.name}
                                        >
                                            {actor.name}
                                        </p>
                                        {actor.character && (
                                            <p
                                                className="text-[11px] text-gray-400 truncate max-w-full mt-0.5"
                                                title={actor.character}
                                            >
                                                {actor.character}
                                            </p>
                                        )}
                                        {actor.total_episode_count && actor.total_episode_count > 0 && (
                                            <span className="mt-1.5 inline-block text-[10px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full truncate max-w-full">
                                                {actor.total_episode_count} {actor.total_episode_count === 1 ? "ep" : "eps"}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>

                            {/* Expand / Collapse Button if cast is large */}
                            {hasMore && (
                                <div className="flex justify-center pt-5">
                                    <button
                                        type="button"
                                        onClick={handleToggleExpand}
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
        </div>
    );
}
