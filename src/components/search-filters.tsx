"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useMemo } from "react";
import {
    SlidersHorizontal,
    X,
    Film,
    Tv,
    Star,
    Calendar,
    Globe,
    MapPin,
    ChevronDown,
    Check,
    Search,
    Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "ko", name: "Korean" },
    { code: "ja", name: "Japanese" },
    { code: "fr", name: "French" },
    { code: "es", name: "Spanish" },
    { code: "hi", name: "Hindi" },
    { code: "bn", name: "Bengali" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "ml", name: "Malayalam" },
    { code: "kn", name: "Kannada" },
    { code: "zh", name: "Chinese" },
];

const REGIONS = [
    { code: "US", name: "United States" },
    { code: "KR", name: "South Korea" },
    { code: "JP", name: "Japan" },
    { code: "IN", name: "India" },
    { code: "FR", name: "France" },
    { code: "GB", name: "United Kingdom" },
];

const YEAR_PRESETS = [
    "2026",
    "2025",
    "2024",
    "2023",
    "2022",
    "2021",
    "2020",
    "2019",
    "2018",
    "2015",
    "2010",
    "2000",
    "1990",
];

interface FilterOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface FilterDropdownProps {
    id: string;
    label: string;
    icon: React.ReactNode;
    value: string;
    placeholder: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    onClear: () => void;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    searchable?: boolean;
    searchPlaceholder?: string;
    customSlot?: React.ReactNode;
    isDrawer?: boolean;
    alignRight?: boolean;
}

function FilterDropdown({
    id,
    label,
    icon,
    value,
    placeholder,
    options,
    onChange,
    onClear,
    isOpen,
    onToggle,
    onClose,
    searchable,
    searchPlaceholder,
    customSlot,
    isDrawer,
    alignRight,
}: FilterDropdownProps) {
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery("");
        }
    }, [isOpen]);

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : value ? value : placeholder;
    const isFiltered = Boolean(value);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchQuery.trim()) return options;
        const q = searchQuery.toLowerCase().trim();
        return options.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, searchable, searchQuery]);

    return (
        <div className="relative w-full" data-filter-dropdown={id}>
            {/* Header label with icon & active indicator - fixed height and margin prevents layout shifts */}
            <div className="flex items-center justify-between px-1 h-4 mb-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                    {icon}
                    <span>{label}</span>
                </span>
                {isFiltered && (
                    <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30 leading-none">
                        Active
                    </span>
                )}
            </div>

            {/* Dropdown trigger button - fixed height & transition-colors prevents layout shaking */}
            <button
                type="button"
                onClick={onToggle}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={cn(
                    "w-full h-10 flex items-center justify-between gap-2 bg-white/5 border rounded-xl px-3 text-xs sm:text-sm text-white transition-colors text-left",
                    isFiltered
                        ? "border-purple-500/60 bg-purple-500/15 text-white font-medium shadow-sm shadow-purple-950/40"
                        : "border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300",
                    isOpen ? "border-purple-500 ring-1 ring-purple-500/30" : ""
                )}
            >
                <span className="truncate flex-1 font-medium">
                    {displayLabel}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {isFiltered && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    onClear();
                                }
                            }}
                            className="p-1 rounded-full hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                            title={`Clear ${label}`}
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown
                        className={cn(
                            "w-3.5 h-3.5 text-gray-400 transition-transform duration-200",
                            isOpen && "rotate-180 text-purple-400"
                        )}
                    />
                </div>
            </button>

            {/* Dropdown menu container - ALWAYS absolute with opacity fade only to prevent layout expansion/shaking */}
            {isOpen && (
                <div
                    className={cn(
                        "absolute top-full left-0 w-full mt-1.5 z-50 bg-[#0e0e1a]/98 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl shadow-black/95 p-1.5 animate-in fade-in duration-100",
                        !isDrawer && alignRight && "right-0 left-auto"
                    )}
                >
                    {searchable && (
                        <div className="relative mb-1.5 px-1 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchPlaceholder || `Search ${label.toLowerCase()}...`}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                            />
                        </div>
                    )}

                    {customSlot}

                    <div className="max-h-56 overflow-y-auto overscroll-contain scrollbar-hide space-y-0.5">
                        {filteredOptions.length === 0 ? (
                            <div className="py-3 text-center text-xs text-gray-500">
                                No matching options
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = value === opt.value;
                                return (
                                    <button
                                        key={opt.value || "__all__"}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            onClose();
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left",
                                            isSelected
                                                ? "bg-purple-600/30 text-purple-200 font-semibold"
                                                : "text-gray-300 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            {opt.icon}
                                            <span className="truncate">{opt.label}</span>
                                        </span>
                                        {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SearchFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [customYearInput, setCustomYearInput] = useState("");

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }
            params.delete("page");
            return params.toString();
        },
        [searchParams]
    );

    const updateFilter = (name: string, value: string) => {
        router.replace("/?" + createQueryString(name, value), { scroll: false });
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("type");
        params.delete("with_genres");
        params.delete("primary_release_year");
        params.delete("vote_average.gte");
        params.delete("with_original_language");
        params.delete("region");
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : "/", { scroll: false });
        setOpenDropdownId(null);
    };

    const currentType = searchParams.get("type") || "";
    const currentGenre = searchParams.get("with_genres") || "";
    const currentYear = searchParams.get("primary_release_year") || "";
    const currentRating = searchParams.get("vote_average.gte") || "";
    const currentLang = searchParams.get("with_original_language") || "";
    const currentRegion = searchParams.get("region") || "";

    const activeCount = [
        currentType,
        currentGenre,
        currentYear,
        currentRating,
        currentLang,
        currentRegion,
    ].filter(Boolean).length;

    // Close open dropdown when clicking outside
    useEffect(() => {
        function handleDocumentClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-filter-dropdown]")) {
                setOpenDropdownId(null);
            }
        }
        if (openDropdownId) {
            document.addEventListener("mousedown", handleDocumentClick);
        }
        return () => {
            document.removeEventListener("mousedown", handleDocumentClick);
        };
    }, [openDropdownId]);

    // Handle Escape key
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                if (openDropdownId) {
                    setOpenDropdownId(null);
                } else if (isMobileDrawerOpen) {
                    setIsMobileDrawerOpen(false);
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [openDropdownId, isMobileDrawerOpen]);

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
        if (isMobileDrawerOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isMobileDrawerOpen]);

    // Dropdown options with clean monochrome UI icons (no emojis)
    const typeOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "All Types",
                icon: <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />,
            },
            {
                value: "movie",
                label: "Movies",
                icon: <Film className="w-3.5 h-3.5 text-gray-400" />,
            },
            {
                value: "tv",
                label: "TV Series",
                icon: <Tv className="w-3.5 h-3.5 text-gray-400" />,
            },
        ],
        []
    );

    const genreOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "All Genres",
                icon: <Clapperboard className="w-3.5 h-3.5 text-gray-400" />,
            },
            ...GENRES.map((g) => ({
                value: String(g.id),
                label: g.name,
            })),
        ],
        []
    );

    const ratingOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "Any Rating",
                icon: <Star className="w-3.5 h-3.5 text-gray-400" />,
            },
            ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => ({
                value: String(r),
                label: `${r}+ Stars`,
                icon: <Star className="w-3.5 h-3.5 text-gray-400" />,
            })),
        ],
        []
    );

    const languageOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "All Languages",
                icon: <Globe className="w-3.5 h-3.5 text-gray-400" />,
            },
            ...LANGUAGES.map((l) => ({
                value: l.code,
                label: l.name,
            })),
        ],
        []
    );

    const regionOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "All Regions",
                icon: <MapPin className="w-3.5 h-3.5 text-gray-400" />,
            },
            ...REGIONS.map((r) => ({
                value: r.code,
                label: r.name,
            })),
        ],
        []
    );

    const yearOptions: FilterOption[] = useMemo(
        () => [
            {
                value: "",
                label: "All Years",
                icon: <Calendar className="w-3.5 h-3.5 text-gray-400" />,
            },
            ...YEAR_PRESETS.map((y) => ({
                value: y,
                label: y,
            })),
        ],
        []
    );

    const yearCustomSlot = (
        <div
            className="p-1 pb-2 mb-1.5 border-b border-white/10 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
        >
            <span className="text-[10px] text-gray-400 font-semibold block px-1">
                Custom Year
            </span>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    placeholder="e.g. 1999"
                    value={customYearInput}
                    min="1900"
                    max="2035"
                    onChange={(e) => setCustomYearInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && customYearInput) {
                            updateFilter("primary_release_year", customYearInput);
                            setOpenDropdownId(null);
                            setCustomYearInput("");
                        }
                    }}
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                />
                <button
                    type="button"
                    onClick={() => {
                        if (customYearInput) {
                            updateFilter("primary_release_year", customYearInput);
                            setOpenDropdownId(null);
                            setCustomYearInput("");
                        }
                    }}
                    disabled={!customYearInput}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors shrink-0"
                >
                    Apply
                </button>
            </div>
        </div>
    );

    const renderDropdowns = (isDrawer: boolean) => (
        <>
            {/* 1. Type */}
            <FilterDropdown
                id={isDrawer ? "drawer-type" : "type"}
                label="Type"
                icon={<Film className="w-3.5 h-3.5 text-gray-400" />}
                value={currentType}
                placeholder="All Types"
                options={typeOptions}
                onChange={(val) => updateFilter("type", val)}
                onClear={() => updateFilter("type", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-type" : "type")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-type" : "type")
                            ? null
                            : isDrawer
                            ? "drawer-type"
                            : "type"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                isDrawer={isDrawer}
            />

            {/* 2. Genre */}
            <FilterDropdown
                id={isDrawer ? "drawer-genre" : "genre"}
                label="Genre"
                icon={<Clapperboard className="w-3.5 h-3.5 text-gray-400" />}
                value={currentGenre}
                placeholder="All Genres"
                options={genreOptions}
                onChange={(val) => updateFilter("with_genres", val)}
                onClear={() => updateFilter("with_genres", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-genre" : "genre")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-genre" : "genre")
                            ? null
                            : isDrawer
                            ? "drawer-genre"
                            : "genre"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                searchable
                searchPlaceholder="Search genre..."
                isDrawer={isDrawer}
            />

            {/* 3. Year */}
            <FilterDropdown
                id={isDrawer ? "drawer-year" : "year"}
                label="Year"
                icon={<Calendar className="w-3.5 h-3.5 text-gray-400" />}
                value={currentYear}
                placeholder="All Years"
                options={yearOptions}
                onChange={(val) => updateFilter("primary_release_year", val)}
                onClear={() => updateFilter("primary_release_year", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-year" : "year")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-year" : "year")
                            ? null
                            : isDrawer
                            ? "drawer-year"
                            : "year"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                customSlot={yearCustomSlot}
                isDrawer={isDrawer}
            />

            {/* 4. Min Rating */}
            <FilterDropdown
                id={isDrawer ? "drawer-rating" : "rating"}
                label="Min Rating"
                icon={<Star className="w-3.5 h-3.5 text-gray-400" />}
                value={currentRating}
                placeholder="Any Rating"
                options={ratingOptions}
                onChange={(val) => updateFilter("vote_average.gte", val)}
                onClear={() => updateFilter("vote_average.gte", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-rating" : "rating")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-rating" : "rating")
                            ? null
                            : isDrawer
                            ? "drawer-rating"
                            : "rating"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                isDrawer={isDrawer}
            />

            {/* 5. Language */}
            <FilterDropdown
                id={isDrawer ? "drawer-language" : "language"}
                label="Language"
                icon={<Globe className="w-3.5 h-3.5 text-gray-400" />}
                value={currentLang}
                placeholder="All Languages"
                options={languageOptions}
                onChange={(val) => updateFilter("with_original_language", val)}
                onClear={() => updateFilter("with_original_language", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-language" : "language")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-language" : "language")
                            ? null
                            : isDrawer
                            ? "drawer-language"
                            : "language"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                searchable
                searchPlaceholder="Search language..."
                isDrawer={isDrawer}
                alignRight
            />

            {/* 6. Region */}
            <FilterDropdown
                id={isDrawer ? "drawer-region" : "region"}
                label="Region"
                icon={<MapPin className="w-3.5 h-3.5 text-gray-400" />}
                value={currentRegion}
                placeholder="All Regions"
                options={regionOptions}
                onChange={(val) => updateFilter("region", val)}
                onClear={() => updateFilter("region", "")}
                isOpen={openDropdownId === (isDrawer ? "drawer-region" : "region")}
                onToggle={() =>
                    setOpenDropdownId(
                        openDropdownId === (isDrawer ? "drawer-region" : "region")
                            ? null
                            : isDrawer
                            ? "drawer-region"
                            : "region"
                    )
                }
                onClose={() => setOpenDropdownId(null)}
                isDrawer={isDrawer}
                alignRight
            />
        </>
    );

    return (
        <div className="mb-6">
            {/* DESKTOP LAYOUT (md and up): Clean 6-column grid without background card */}
            <div className="hidden md:block space-y-3">
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                    {renderDropdowns(false)}
                </div>

                {/* Active filters status & reset */}
                {activeCount > 0 && (
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                        <span className="text-[11px] font-medium text-gray-400">
                            {activeCount} {activeCount === 1 ? "filter" : "filters"} applied
                        </span>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors px-2.5 py-1 rounded-lg hover:bg-red-500/10"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    </div>
                )}
            </div>

            {/* MOBILE TRIGGER BUTTON (< md): Positioned on the RIGHT side of mobile screen */}
            <div className="flex md:hidden items-center justify-end gap-2.5">
                {activeCount > 0 && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>Reset ({activeCount})</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setOpenDropdownId(null);
                        setIsMobileDrawerOpen(true);
                    }}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-colors shadow-sm",
                        activeCount > 0
                            ? "bg-purple-600/25 border-purple-500/60 text-purple-200 shadow-purple-900/30"
                            : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                    )}
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Filters</span>
                    {activeCount > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                            {activeCount}
                        </span>
                    )}
                </button>
            </div>

            {/* MOBILE SLIDER PANEL DRAWER: Sliding in from the RIGHT */}
            {isMobileDrawerOpen && (
                <>
                    {/* Backdrop Overlay */}
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200 md:hidden"
                        onClick={() => {
                            setOpenDropdownId(null);
                            setIsMobileDrawerOpen(false);
                        }}
                        aria-hidden="true"
                    />

                    {/* Right Slide-in Panel */}
                    <div
                        className="fixed inset-y-0 right-0 w-[88%] max-w-sm bg-[#0b0b14] border-l border-white/15 z-50 flex flex-col justify-between shadow-2xl shadow-black/95 animate-in slide-in-from-right duration-250 md:hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Filter Options"
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-purple-400" />
                                <h3 className="text-base font-bold text-white">Filter Discovery</h3>
                                {activeCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                                        {activeCount} active
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDropdownId(null);
                                    setIsMobileDrawerOpen(false);
                                }}
                                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                aria-label="Close filters"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Drawer Scrollable Content: Sleek Dropdown Options with generous bottom padding */}
                        <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto overscroll-contain pb-40">
                            {renderDropdowns(true)}
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3 flex-shrink-0 bg-[#0d0d16]">
                            {activeCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-red-400 text-xs font-semibold border border-white/10 transition-colors text-center"
                                >
                                    Reset All
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDropdownId(null);
                                    setIsMobileDrawerOpen(false);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all text-center"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
