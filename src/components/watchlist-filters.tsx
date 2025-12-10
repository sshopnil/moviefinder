"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebounce } from "use-debounce";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

// Internal constant removed, passed via props


const SORT_OPTIONS = [
    { value: "date_desc", label: "Date Added (Newest)" },
    { value: "date_asc", label: "Date Added (Oldest)" },
    { value: "release_desc", label: "Release Date (Newest)" },
    { value: "release_asc", label: "Release Date (Oldest)" },
    { value: "rating_desc", label: "Rating (High to Low)" },
    { value: "rating_asc", label: "Rating (Low to High)" },
];

export function WatchlistFilters({
    availableGenres
}: {
    availableGenres: { id: number; name: string }[]
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const [text, setText] = useState(searchParams.get("query") || "");
    const [query] = useDebounce(text, 500);

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("query", term);
        } else {
            params.delete("query");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    const handleSort = (sort: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("sortBy", sort);
        replace(`${pathname}?${params.toString()}`);
    };

    const handleGenre = (genreId: string) => {
        const params = new URLSearchParams(searchParams);
        if (genreId && genreId !== "all") {
            params.set("genreId", genreId);
        } else {
            params.delete("genreId");
        }
        replace(`${pathname}?${params.toString()}`);
    };

    useEffect(() => {
        handleSearch(query);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    return (
        <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                    placeholder="Search your watchlist..."
                    onChange={(e) => setText(e.target.value)}
                    defaultValue={searchParams.get("query")?.toString()}
                />
            </div>

            <select
                className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors [&>option]:bg-zinc-900"
                onChange={(e) => handleGenre(e.target.value)}
                defaultValue={searchParams.get("genreId")?.toString() || "all"}
            >
                <option value="all">All Genres</option>
                {availableGenres.map((genre) => (
                    <option key={genre.id} value={genre.id}>
                        {genre.name}
                    </option>
                ))}
            </select>

            <select
                className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors [&>option]:bg-zinc-900"
                onChange={(e) => handleSort(e.target.value)}
                defaultValue={searchParams.get("sortBy")?.toString() || "date_desc"}
            >
                {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
