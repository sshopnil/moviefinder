"use client";

import { Movie } from "@/types/movie";
import { MovieCard } from "@/components/movie-card";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Link from "next/link";

interface MovieSectionProps {
    title: string;
    description?: string;
    movies: Movie[];
    viewAllLink?: string;
    totalCount?: number;
}

export function MovieSection({ title, description, movies, viewAllLink, totalCount }: MovieSectionProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Config: Initial rows to show (2 rows of 4-5 items = 10 items)
    const INITIAL_COUNT = 10;
    const displayedMovies = isExpanded ? movies : movies.slice(0, INITIAL_COUNT);
    const hasMore = movies.length > INITIAL_COUNT;

    if (movies.length === 0) return null;

    return (
        <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-end justify-between mb-6 border-b border-white/5 pb-2">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        {title}
                    </h2>
                    {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
                </div>
                {viewAllLink && (
                    <Link href={viewAllLink} className="text-sm text-blue-400 hover:text-blue-300 transition-colors mb-1">
                        View All
                        {totalCount ? ` (${totalCount})` : " >"}
                    </Link>
                )}
            </div>

            <motion.div layout className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                <AnimatePresence mode="popLayout">
                    {displayedMovies.map((movie) => (
                        <motion.div
                            key={movie.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MovieCard movie={movie} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {hasMore && (
                <div className="flex justify-center mt-8">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="group flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all text-sm font-medium text-gray-300 hover:text-white"
                    >
                        {isExpanded ? (
                            <>
                                Show Less <ChevronUp className="h-4 w-4 text-blue-400 group-hover:-translate-y-1 transition-transform" />
                            </>
                        ) : (
                            <>
                                See More <ChevronDown className="h-4 w-4 text-blue-400 group-hover:translate-y-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            )}
        </section>
    );
}
