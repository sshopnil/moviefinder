"use strict";
"use client";

import { useState, useMemo } from "react";
import { Movie } from "@/types/movie";
import { MovieCard } from "@/components/movie-card";
import { Search } from "lucide-react";
import { MOVIE_GENRES } from "@/lib/genres";

interface MovieBrowserProps {
    movies: Movie[];
    title?: string;
    description?: string;
}

const SORT_OPTIONS = [
    { value: "popularity_desc", label: "Most Popular" },
    { value: "date_desc", label: "Newest Releases" },
    { value: "date_asc", label: "Oldest Releases" },
    { value: "rating_desc", label: "Highest Rated" },
    { value: "rating_asc", label: "Lowest Rated" },
];

export function MovieBrowser({ movies, title, description }: MovieBrowserProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGenre, setSelectedGenre] = useState("all");
    const [sortBy, setSortBy] = useState("popularity_desc");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Extract unique genres from available movies
    const availableGenres = useMemo(() => {
        const genreIds = new Set<number>();
        movies.forEach(movie => {
            movie.genre_ids?.forEach(id => genreIds.add(id));
        });
        return MOVIE_GENRES.filter(g => genreIds.has(g.id));
    }, [movies]);

    const filteredAndSortedMovies = useMemo(() => {
        let result = [...movies];

        // 1. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m => m.title.toLowerCase().includes(q));
        }

        // 2. Genre Filter
        if (selectedGenre !== "all") {
            const genreId = parseInt(selectedGenre);
            result = result.filter(m => m.genre_ids?.includes(genreId));
        }

        // 3. Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case "date_desc":
                    return new Date(b.release_date || "1900").getTime() - new Date(a.release_date || "1900").getTime();
                case "date_asc":
                    return new Date(a.release_date || "2100").getTime() - new Date(b.release_date || "2100").getTime();
                case "rating_desc":
                    return b.vote_average - a.vote_average;
                case "rating_asc":
                    return a.vote_average - b.vote_average;
                case "popularity_desc":
                default:
                    return b.popularity - a.popularity;
            }
        });

        return result;
    }, [movies, searchQuery, selectedGenre, sortBy]);

    // Reset page when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedGenre, sortBy]);

    // Calculate pagination properties
    const totalItems = filteredAndSortedMovies.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedMovies = filteredAndSortedMovies.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            // Optional: Scroll to top of grid
            // window.scrollTo({ top: 0, behavior: 'smooth' }); // Can be annoying if widget is lower down
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                {title && <h2 className="text-2xl font-bold text-white">{title} ({movies.length})</h2>}
                {description && <p className="text-gray-400">{description}</p>}

                <p className="text-gray-400 text-sm">
                    Showing {paginatedMovies.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} movies
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                        placeholder="Search movies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors [&>option]:bg-zinc-900"
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    value={selectedGenre}
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
                    onChange={(e) => setSortBy(e.target.value)}
                    value={sortBy}
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Grid */}
            {paginatedMovies.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {paginatedMovies.map((movie) => (
                            <MovieCard key={movie.id} movie={movie} />
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages >= 1 && (
                        <div className="flex justify-center items-center gap-4 mt-8 pt-6 border-t border-white/10">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                            >
                                Previous
                            </button>

                            <span className="text-gray-400 text-sm">
                                Page <span className="text-white font-medium">{currentPage}</span> of <span className="text-white font-medium">{totalPages}</span>
                            </span>

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20 text-gray-500">
                    No movies found matching your filters.
                </div>
            )}
        </div>
    );
}
