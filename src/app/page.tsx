"use client";

import { useEffect, useState } from "react";
import { Movie } from "@/types/movie";
import { getTrendingMoviesAction, searchMoviesAction, getRecommendationsAction } from "./actions";
import { MovieCard } from "@/components/movie-card";
import { SearchBar } from "@/components/search-bar";
import { MoodSelector } from "@/components/mood-selector";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewTitle, setViewTitle] = useState("Trending Now");

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setIsLoading(true);
    try {
      const data = await getTrendingMoviesAction();
      setMovies(data);
      setViewTitle("Trending Now");
    } catch (error) {
      console.error("Failed to load trending:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const results = await searchMoviesAction(query);
      setMovies(results);
      setViewTitle(`Results for "${query}"`);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoodSubmit = async (mood: string) => {
    setIsLoading(true);
    setViewTitle(`AI Recommendations for "${mood}"`);
    try {
      const recommendedMovies = await getRecommendationsAction(mood);
      setMovies(recommendedMovies);
    } catch (error) {
      console.error("Mood search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col items-center gap-6 text-center pt-8 fade-in">
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          MovieFinder
        </h1>
        <p className="text-gray-400 max-w-lg">
          Discover movies through search or describe your mood to our AI.
        </p>

        <div className="w-full max-w-4xl flex flex-col gap-4 items-center z-10">
          <SearchBar onSearch={handleSearch} />
          <MoodSelector onMoodSubmit={handleMoodSubmit} isLoading={isLoading} />
        </div>
      </header>

      {/* Grid */}
      <section className="flex-1 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white/90">{viewTitle}</h2>
          {/* Add Filter/Sort UI here potentially */}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
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
        )}

        {!isLoading && movies.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No movies found. Try a different search.
          </div>
        )}
      </section>
    </main>
  );
}
