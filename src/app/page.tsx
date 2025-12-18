import { Suspense } from "react";
import { movieService, tvService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { getRecommendationsFromMood } from "@/lib/ai";
import { MovieGrid } from "@/components/movie-grid";
import { MovieSection } from "@/components/movie-section";
import { Movie, TVSeries } from "@/types/movie";
import { PersonCard } from "@/components/person-card";
import { ClientHeader } from "@/components/client-header";

import { SearchFilters } from "@/components/search-filters";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { logSearchAction } from "@/actions/history";
import { Pagination } from "@/components/pagination";

// Server Component
export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q;
  const mood = searchParams.mood;
  const page = searchParams.page ? parseInt(searchParams.page) : 1;

  // Filters
  const type = searchParams.type;
  const with_genres = searchParams.with_genres;
  const primary_release_year = searchParams.primary_release_year;
  const vote_average_gte = searchParams["vote_average.gte"];
  const with_original_language = searchParams.with_original_language;
  const region = searchParams.region;

  let movies: (Movie & { aiMeta?: any })[] = [];
  let tv: (TVSeries & { aiMeta?: any })[] = [];
  let people: any[] = [];
  let viewTitle = "Trending Now";
  let isSearchOrFilter = false;
  let totalPages = 1;

  let homeSections: {
    title: string;
    items: (Movie | TVSeries)[];
    description?: string;
    viewAllLink?: string;
    totalCount?: number;
  }[] = [];

  if (query) {
    isSearchOrFilter = true;
    viewTitle = `Results for "${query}"`;
    try {
      const results = await movieService.searchMulti(query, page);
      logSearchAction(query).catch(err => console.error("Failed to log search:", err));

      movies = results.movies;
      tv = results.tv;
      people = results.people;
      totalPages = results.total_pages;

      if (type) {
        if (type === "movie") tv = [];
        if (type === "tv") movies = [];
      }

      // Note: Filtering after fetching from TMDB might reduce results per page
      // but TMDB doesn't support complex filtering in search_multi.
      // For better results, if type is specified, we could use searchMovie/searchTV directly.
      if (with_genres) {
        const genreId = parseInt(with_genres);
        movies = movies.filter(m => m.genre_ids?.includes(genreId));
        tv = tv.filter(s => s.genre_ids?.includes(genreId));
      }
      if (primary_release_year) {
        movies = movies.filter(m => m.release_date?.startsWith(primary_release_year));
        tv = tv.filter(s => s.first_air_date?.startsWith(primary_release_year));
      }
      if (vote_average_gte) {
        const minVote = parseFloat(vote_average_gte);
        movies = movies.filter(m => m.vote_average >= minVote);
        tv = tv.filter(s => s.vote_average >= minVote);
      }
      if (with_original_language) {
        movies = movies.filter(m => m.original_language === with_original_language);
        tv = tv.filter(s => s.original_language === with_original_language);
      }
    } catch (e) {
      console.error(e);
    }
  } else if (mood) {
    isSearchOrFilter = true;
    viewTitle = `AI Recommendations for "${mood}"`;
    try {
      // AI Recommendations are usually small set, no pagination needed for now
      const recommendations = await getRecommendationsFromMood(mood);
      const results = await Promise.all(
        recommendations.map(async (rec) => {
          let movieData: any = null;
          if (rec.type === "movie") {
            const matches = await movieService.searchMovies(rec.title);
            movieData = matches[0] ? { ...matches[0], media_type: "movie" as const } : null;
          } else {
            const matches = await tvService.searchTV(rec.title);
            movieData = matches[0] ? { ...matches[0], media_type: "tv" as const } : null;
          }

          if (movieData) {
            return {
              ...movieData,
              aiMeta: rec
            };
          }
          return null;
        })
      );

      const items = results.filter(Boolean) as ((Movie | TVSeries) & { aiMeta?: any })[];
      const seen = new Set();
      const uniqueItems = items.filter(item => {
        const duplicate = seen.has(`${item.media_type}-${item.id}`);
        seen.add(`${item.media_type}-${item.id}`);
        return !duplicate && item.poster_path;
      });

      let filteredItems = uniqueItems;
      if (type) {
        filteredItems = uniqueItems.filter(i => i.media_type === type);
      }

      if (with_genres) {
        const genreId = parseInt(with_genres);
        movies = filteredItems.filter(i => i.media_type === "movie" && i.genre_ids?.includes(genreId)) as any;
        tv = filteredItems.filter(i => i.media_type === "tv" && i.genre_ids?.includes(genreId)) as any;
      } else {
        movies = filteredItems.filter(i => i.media_type === "movie") as any;
        tv = filteredItems.filter(i => i.media_type === "tv") as any;
      }
    } catch (e) {
      console.error(e);
    }
  } else if (type || with_genres || primary_release_year || vote_average_gte || with_original_language || region) {
    isSearchOrFilter = true;
    viewTitle = "Filtered Results";
    try {
      if (!type || type === "movie") {
        const movieResults = await movieService.getDiscover({
          with_genres,
          primary_release_year,
          "vote_average.gte": vote_average_gte,
          with_original_language,
          region,
          page: page.toString()
        });
        movies = movieResults.results;
        totalPages = Math.max(totalPages, movieResults.total_pages);
      }
      if (!type || type === "tv") {
        const tvResults = await tvService.getDiscover({
          with_genres,
          "vote_average.gte": vote_average_gte,
          with_original_language,
          page: page.toString()
        });
        tv = tvResults.results;
        totalPages = Math.max(totalPages, tvResults.total_pages);
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    try {
      const [trendingMovies, trendingTV, popularMovies, popularTV, animeSeries] = await Promise.all([
        movieService.getTrending(),
        tvService.getTrending(),
        movieService.getPopular(),
        tvService.getPopular(),
        tvService.getDiscover({
          with_genres: "16", // Animation
          with_original_language: "ja", // Japanese
          sort_by: "popularity.desc"
        })
      ]);

      homeSections = [
        {
          title: "Anime Highlights",
          items: animeSeries.results.slice(0, 12),
          description: "Top Japanese Animation",
          viewAllLink: "/?with_genres=16&with_original_language=ja",
          totalCount: animeSeries.total_results
        },
        {
          title: "Trending Movies",
          items: trendingMovies.slice(0, 12),
          description: "Top movies this week",
          viewAllLink: "/?type=movie",
          totalCount: trendingMovies.length
        },
        {
          title: "Trending TV Series",
          items: trendingTV.slice(0, 12),
          description: "Top shows this week",
          viewAllLink: "/?type=tv",
          totalCount: trendingTV.length
        },
        {
          title: "Popular Movies",
          items: popularMovies.slice(0, 12),
          description: "Current movie favorites",
          viewAllLink: "/?type=movie&sort_by=popularity_desc",
          totalCount: popularMovies.length
        }
      ];
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen flex flex-col gap-8">
      <header className="flex flex-col items-center gap-6 text-center pt-8 fade-in">
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          MovieFinder
        </h1>
        <p className="text-gray-400 max-w-lg">
          Discover movies and TV series through search, filters, or describe your mood.
        </p>

        <div className="w-full max-w-4xl flex flex-col gap-4 items-center z-10">
          <ClientHeader />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <SearchFilters />

        {people.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-blue-500">People</h2>
              {people.length > 5 && (
                <Link href={`/search/people?q=${encodeURIComponent(query as string)}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View All People ({people.length})
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {people.slice(0, 6).map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          </div>
        )}

        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        }>
          {isSearchOrFilter ? (
            <div className="space-y-12">
              {[...movies, ...tv].length > 0 ? (
                <>
                  <MovieGrid movies={[...movies, ...tv] as any} title={viewTitle} />
                  <Pagination currentPage={page} totalPages={totalPages} />
                </>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  No results found. Try a different search.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {homeSections.map((section) => (
                <MovieSection
                  key={section.title}
                  title={section.title}
                  movies={section.items as any}
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
