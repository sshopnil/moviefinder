import { Suspense } from "react";
import { movieService, tvService } from "@/lib/tmdb";
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
import { AISearchResults } from "@/components/ai-search-results";
import { AIActorSearchResults } from "@/components/ai-actor-search-results";
import { matchesGenreFilter, getGenreIdForDiscover } from "@/lib/genres";

export const revalidate = 3600;

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
  const rawSortBy = searchParams.sort_by;
  const sort_by = rawSortBy === "popularity_desc" ? "popularity.desc" : rawSortBy;

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

  // Handle Mood Search separately to enable Brain Loader
  if (mood) {
    const isActorAI = type === "person" && searchParams.actorId && searchParams.actorName;

    return (
      <main className="container mx-auto px-4 py-8 min-h-screen flex flex-col gap-8">
        <HomeHeader />
        <div className="flex flex-col gap-4">
          <SearchFilters />
          <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-500" /></div>}>
            {isActorAI ? (
              <AIActorSearchResults
                mood={mood}
                actorId={Number(searchParams.actorId)}
                actorName={searchParams.actorName || ""}
                initialProfilePath={searchParams.actorProfile}
              />
            ) : (
              <AISearchResults mood={mood} type={type} with_genres={with_genres} page={page} />
            )}
          </Suspense>
        </div>
      </main>
    );
  }

  if (query) {
    isSearchOrFilter = true;
    if (type === "person") {
      viewTitle = `Actors & Actresses for "${query}"`;
      try {
        logSearchAction(query).catch(err => console.error("Failed to log search:", err));
        people = await movieService.searchPeople(query);
      } catch (e) {
        console.error(e);
      }
    } else {
      viewTitle = type === "tv" ? `TV Series for "${query}"` : type === "movie" ? `Movies for "${query}"` : `Results for "${query}"`;
      try {
        logSearchAction(query).catch(err => console.error("Failed to log search:", err));

        if (type === "movie") {
          const results = await movieService.searchMovies(query, page);
          movies = results.results;
          totalPages = results.total_pages;
        } else if (type === "tv") {
          const results = await tvService.searchTV(query, page);
          tv = results.results;
          totalPages = results.total_pages;
        } else {
          const results = await movieService.searchMulti(query, page);
          movies = results.movies;
          tv = results.tv;
          people = results.people;
          totalPages = results.total_pages;
        }

        // Note: Filtering after fetching from TMDB might reduce results per page
        // but TMDB doesn't support complex filtering in search_multi.
        // For better results, if type is specified, we could use searchMovie/searchTV directly.
        if (with_genres) {
          movies = movies.filter(m => matchesGenreFilter(m.genre_ids, with_genres, "movie"));
          tv = tv.filter(s => matchesGenreFilter(s.genre_ids, with_genres, "tv"));
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
    }
  } else if (type || with_genres || primary_release_year || vote_average_gte || with_original_language || region || sort_by) {
    isSearchOrFilter = true;
    viewTitle = "Filtered Results";
    try {
      if (!type) {
        const [movieResults, tvResults] = await Promise.all([
          movieService.getDiscover({
            with_genres: with_genres ? getGenreIdForDiscover(with_genres, "movie") : undefined,
            primary_release_year,
            "vote_average.gte": vote_average_gte,
            with_original_language,
            region,
            sort_by,
            page: page.toString()
          }),
          tvService.getDiscover({
            with_genres: with_genres ? getGenreIdForDiscover(with_genres, "tv") : undefined,
            first_air_date_year: primary_release_year,
            "vote_average.gte": vote_average_gte,
            with_original_language,
            region,
            sort_by,
            page: page.toString()
          })
        ]);
        movies = movieResults.results;
        tv = tvResults.results;
        totalPages = Math.max(totalPages, movieResults.total_pages, tvResults.total_pages);
      } else if (type === "movie") {
        const movieResults = await movieService.getDiscover({
          with_genres: with_genres ? getGenreIdForDiscover(with_genres, "movie") : undefined,
          primary_release_year,
          "vote_average.gte": vote_average_gte,
          with_original_language,
          region,
          sort_by,
          page: page.toString()
        });
        movies = movieResults.results;
        totalPages = Math.max(totalPages, movieResults.total_pages);
      } else if (type === "tv") {
        const tvResults = await tvService.getDiscover({
          with_genres: with_genres ? getGenreIdForDiscover(with_genres, "tv") : undefined,
          first_air_date_year: primary_release_year,
          "vote_average.gte": vote_average_gte,
          with_original_language,
          region,
          sort_by,
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
          viewAllLink: "/?type=movie&sort_by=popularity.desc",
          totalCount: popularMovies.length
        },
        {
          title: "Popular TV Series",
          items: popularTV.slice(0, 12),
          description: "Current TV series favorites",
          viewAllLink: "/?type=tv&sort_by=popularity.desc",
          totalCount: popularTV.length
        }
      ];
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen flex flex-col gap-8">
      <HomeHeader />

      <div className="flex flex-col gap-4">
        <SearchFilters />

        {type === "person" ? (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-purple-500">
                {viewTitle} ({people.length})
              </h2>
            </div>
            {people.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {people.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                No actors or actresses found for &quot;{query}&quot;. Try a different name.
              </div>
            )}
          </div>
        ) : (
          <>
            {people.length > 0 && (
              <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-blue-500">People</h2>
                  {people.length > 5 && (
                    <Link href={`/search/people?q=${encodeURIComponent(query as string)}`} prefetch={false} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
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

            <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-500" /></div>}>
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
          </>
        )}
      </div>
    </main>
  );
}

function HomeHeader() {
  return (
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
  )
}
