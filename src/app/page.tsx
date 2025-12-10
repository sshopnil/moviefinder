
import { Suspense } from "react";
import { movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { MovieGrid } from "@/components/movie-grid";
import { Loader2 } from "lucide-react";
import { Movie } from "@/types/movie";
import { ClientHeader } from "@/components/client-header";

import { SearchFilters } from "@/components/search-filters";
import Link from "next/link";
import Image from "next/image";

// Server Component
export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const mood = searchParams.mood;

  // Filters
  const with_genres = searchParams.with_genres;
  const primary_release_year = searchParams.primary_release_year;
  const vote_average_gte = searchParams["vote_average.gte"];

  let movies: Movie[] = [];
  let people: any[] = [];
  let viewTitle = "Trending Now";

  // Data Fetching logic on the server
  // Priority: Query (Multi) > Filters (Discover) > Mood (AI) > Trending
  if (query) {
    viewTitle = `Results for "${query}"`;
    try {
      const results = await movieService.searchMulti(query);
      movies = results.movies;
      people = results.people;
    } catch (e) {
      console.error(e);
    }
  } else if (with_genres || primary_release_year || vote_average_gte) {
    viewTitle = "Filtered Results";
    try {
      movies = await movieService.getDiscover({
        with_genres,
        primary_release_year,
        "vote_average.gte": vote_average_gte
      });
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
          Discover movies through search, filters, or describe your mood.
        </p>

        <div className="w-full max-w-4xl flex flex-col gap-4 items-center z-10">
          {/* Client Components for interactivity */}
          <ClientHeader />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <SearchFilters />

        {/* People Results */}
        {people.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-white mb-6 pl-2 border-l-4 border-blue-500">People</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {people.map((person) => (
                <Link key={person.id} href={`/person/${person.id}`} className="group block bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors">
                  <div className="relative aspect-square rounded-full overflow-hidden mb-3 mx-auto max-w-[120px] bg-black/20 group-hover:ring-2 ring-blue-500/50 transition-all">
                    {person.profile_path ? (
                      <Image
                        src={TMDB_IMAGE_URL.profile(person.profile_path)}
                        alt={person.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 text-xs">No Image</div>
                    )}
                  </div>
                  <p className="text-center text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">{person.name}</p>
                  <p className="text-center text-xs text-gray-400 truncate">{person.known_for_department}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Movies Grid */}
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        }>
          <MovieGrid movies={movies} title={viewTitle} />
        </Suspense>
      </div>
    </main>
  );
}
