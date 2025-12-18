"use client";

import { Movie, TVSeries, AIRecommendation } from "@/types/movie";
import { MovieCard } from "@/components/movie-card";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { motion, AnimatePresence } from "framer-motion";

interface MovieGridProps {
    movies: ((Movie | TVSeries) & { aiMeta?: AIRecommendation })[];
    title: string;
}

export function MovieGrid({ movies, title }: MovieGridProps) {
    const hasAIRecommendations = movies.some(m => m.aiMeta);

    return (
        <section className="flex-1 mt-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white/90">{title}</h2>
            </div>

            <motion.div
                layout
                className={`grid gap-4 sm:gap-6 ${hasAIRecommendations
                        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                    }`}
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
                            {movie.aiMeta ? (
                                <AIRecommendationCard movie={movie} />
                            ) : (
                                <MovieCard movie={movie} />
                            )}
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
