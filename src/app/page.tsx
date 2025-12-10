import { Suspense } from "react";
import { movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { MovieBrowser } from "@/components/movie-browser";
import { MovieSection } from "@/components/movie-section";
import { Movie } from "@/types/movie";
import { PersonCard } from "@/components/person-card";
import { ClientHeader } from "@/components/client-header";

import { SearchFilters } from "@/components/search-filters";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { logSearchAction } from "@/actions/history";

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
  const with_original_language = searchParams.with_original_language;
  const region = searchParams.region;

  let movies: Movie[] = [];
  let people: any[] = [];
  let viewTitle = "Trending Now";
  let isSearchOrFilter = false;

  // Regional/Category Data (only fetched if default home view)
  let homeSections: {
    title: string;
    movies: Movie[];
    description?: string;
    viewAllLink?: string;
    totalCount?: number;
  }[] = [];

  // Data Fetching logic on the server
  // Priority: Query (Multi) > Filters (Discover) > Mood (AI) > Default Home (Sections)
  if (query) {
    isSearchOrFilter = true;
    viewTitle = `Results for "${query}"`;
    try {
      const results = await movieService.searchMulti(query);

      // Log search history (fire and forget to not block)
      logSearchAction(query).catch(err => console.error("Failed to log search:", err));

      movies = results.movies;
      people = results.people;

      // Apply in-memory filters to search results
      if (with_genres) {
        const genreId = parseInt(with_genres);
        movies = movies.filter(m => m.genre_ids?.includes(genreId));
      }
      if (primary_release_year) {
        movies = movies.filter(m => m.release_date?.startsWith(primary_release_year));
      }
      if (vote_average_gte) {
        movies = movies.filter(m => m.vote_average >= parseFloat(vote_average_gte));
      }
      if (with_original_language) {
        movies = movies.filter(m => m.original_language === with_original_language);
      }
      // Note: Region filtering for search results is less reliable as TMDB search results
      // might not have all release dates for all regions attached in the list view.
      // We'll skip region filter strict enforcement for search results to avoid over-filtering.

    } catch (e) {
      console.error(e);
    }
  } else if (mood) {
    isSearchOrFilter = true;
    viewTitle = `AI Recommendations for "${mood}"`;
    try {
      const titles = await getRecommendationsFromMood(mood);
      const results = await Promise.all(
        titles.map((title: string) => movieService.searchMovies(title))
      );
      // Flatten and deduplicate
      const allMovies = results.flatMap((r) => r);
      // Basic dedup by ID
      const seen = new Set();
      movies = allMovies.filter(m => {
        const duplicate = seen.has(m.id);
        seen.add(m.id);
        return !duplicate && m.poster_path; // Only show movies with posters for aesthetics
      });

      // Apply in-memory filters to AI results
      if (with_genres) {
        const genreId = parseInt(with_genres);
        movies = movies.filter(m => m.genre_ids?.includes(genreId));
      }
      if (primary_release_year) {
        movies = movies.filter(m => m.release_date?.startsWith(primary_release_year));
      }
      if (vote_average_gte) {
        movies = movies.filter(m => m.vote_average >= parseFloat(vote_average_gte));
      }
      if (with_original_language) {
        movies = movies.filter(m => m.original_language === with_original_language);
      }

      // movies = movies.slice(0, 20); // Removed limit to show all AI results with pagination

    } catch (e) {
      console.error(e);
    }
  } else if (with_genres || primary_release_year || vote_average_gte || with_original_language || region) {
    isSearchOrFilter = true;
    viewTitle = "Filtered Results";
    try {
      movies = await movieService.getDiscover({
        with_genres,
        primary_release_year,
        "vote_average.gte": vote_average_gte,
        with_original_language,
        region
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    // Default Homepage View - Fetch Multiple Sections
    try {
      const [trending, english, korean, japanese, topRated] = await Promise.all([
        movieService.getTrending(),
        movieService.getDiscover({ with_original_language: 'en', region: 'US' }),
        movieService.getDiscover({ with_original_language: 'ko' }),
        movieService.getDiscover({ with_original_language: 'ja' }),
        movieService.getDiscover({ "vote_average.gte": "8", "vote_count.gte": "100" as any }) // vote_count not in type but usually useful, keeping simple
      ]);

      homeSections = [
        {
          title: "Trending Now",
          movies: trending.slice(0, 20),
          description: "Most popular movies this week",
          viewAllLink: "/?sort_by=popularity_desc",
          totalCount: trending.length
        },
        {
          title: "Hollywood Hits",
          movies: english.slice(0, 20),
          description: "Popular English language movies",
          viewAllLink: "/?with_original_language=en&region=US",
          totalCount: english.length
        },
        {
          title: "Best of Korea",
          movies: korean.slice(0, 20),
          description: "Top picks from South Korean cinema",
          viewAllLink: "/?with_original_language=ko",
          totalCount: korean.length
        },
        {
          title: "Japanese Gems",
          movies: japanese.slice(0, 20),
          description: "Anime and live-action favorites from Japan",
          viewAllLink: "/?with_original_language=ja",
          totalCount: japanese.length
        },
        {
          title: "Critically Acclaimed",
          movies: topRated.slice(0, 20),
          description: "Movies with high ratings",
          viewAllLink: "/?vote_average.gte=8",
          totalCount: topRated.length
        },
      ];
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

        {/* People Results (Search Only) */}
        {people.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-blue-500">People</h2>
              {people.length > 5 && (
                <Link href={`/search/people?q=${encodeURIComponent(query as string)}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View All Actors ({people.length})
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {people.slice(0, 5).map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          </div>
        )}

        {/* Movies Content */}
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        }>
          {isSearchOrFilter ? (
            <MovieBrowser movies={movies} title={viewTitle} description={`Found ${movies.length} results`} />
          ) : (
            <div className="space-y-4">
              {homeSections.map((section) => (
                <MovieSection
                  key={section.title}
                  title={section.title}
                  movies={section.movies}
                  description={section.description}
                  viewAllLink={section.viewAllLink}
                  totalCount={section.totalCount}
                />
              ))}
            </div>
          )}
        </Suspense>
      </div>
    </main>
  );
}
