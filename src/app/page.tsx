import { Suspense } from "react";
import { movieService } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { MovieGrid } from "@/components/movie-grid";
import { Loader2 } from "lucide-react";
import { Movie } from "@/types/movie";
import { ClientHeader } from "@/components/client-header";
import { AuthHeader } from "@/components/auth-header";

// Server Component
export default async function Home(props: {
  searchParams: Promise<{ q?: string; mood?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { q: query, mood } = searchParams;

  let movies: Movie[] = [];
  let viewTitle = "Trending Now";

  // Data Fetching logic on the server
  if (query) {
    viewTitle = `Results for "${query}"`;
    try {
      movies = await movieService.searchMovies(query);
    } catch (e) {
      console.error(e);
    }
  } else if (mood) {
    viewTitle = `AI Recommendations for "${mood}"`;
    try {
      const titles = await getRecommendationsFromMood(mood);
      const results = await Promise.all(
        titles.map((title) => movieService.searchMovies(title))
      );
      // Flatten and deduplicate
      const allMovies = results.flatMap((r) => r);
      // Basic dedup by ID
      const seen = new Set();
      movies = allMovies.filter(m => {
        const duplicate = seen.has(m.id);
        seen.add(m.id);
        return !duplicate && m.poster_path; // Only show movies with posters for aesthetics
      }).slice(0, 10); // Limit to top results
    } catch (e) {
      console.error(e);
    }
  } else {
    try {
      movies = await movieService.getTrending();
    } catch (e) {
      console.error(e);
    }
  }

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
          {/* Client Components for interactivity */}
          <ClientHeader />
        </div>
      </header>

      <AuthHeader />

      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-10 w-10 text-white animate-spin" />
        </div>
      }>
        <MovieGrid movies={movies} title={viewTitle} />
      </Suspense>
    </main>
  );
}
