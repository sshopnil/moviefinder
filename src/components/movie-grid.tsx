"use client";

import { Movie } from "@/types/movie";
import { MovieCard } from "@/components/movie-card";
import { motion, AnimatePresence } from "framer-motion";

interface MovieGridProps {
    movies: Movie[];
    title: string;
}

export function MovieGrid({ movies, title }: MovieGridProps) {
    return (
        <section className="flex-1 mt-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white/90">{title}</h2>
            </div>

            <motion.div
                layout
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
                <AnimatePresence mode="popLayout">
                    {movies.map((movie) => (
                        <motion.div
                            key={movie.id}
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

            {movies.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    No movies found. Try a different search.
                </div>
            )}
        </section>
    );
}
