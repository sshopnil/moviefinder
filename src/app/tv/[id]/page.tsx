import type { Metadata } from "next";
import { tvService, movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { BackButton } from "@/components/back-button";
import { Calendar, Clock, Star, Tv } from "lucide-react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MovieActions } from "@/components/movie-actions";
import { Suspense } from "react";
import { TVReviews } from "@/components/tv-reviews";
import { SimilarMedia } from "@/components/similar-media";
import { AIRecommendationSectionSkeleton, MediaCardGridSkeleton, ReviewsSectionSkeleton } from "@/components/ai-result-skeletons";
import { WatchProviders } from "@/components/watch-providers";
import { SourceRecommendations } from "@/components/source-recommendations";
import { SeasonRankingSection } from "@/components/season-ranking-section";
import { TVCastTabs } from "@/components/tv-cast-tabs";

export const revalidate = 86400;

type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ season?: string; episode?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const tvId = Number(id);
    if (!Number.isFinite(tvId)) {
        return { title: "TV Series Not Found | MovieFinder AI" };
    }

    try {
        const tv = await tvService.getTVDetails(tvId);
        if (!tv) return { title: "TV Series Not Found | MovieFinder AI" };

        const firstAirYear = tv.first_air_date ? ` (${tv.first_air_date.slice(0, 4)})` : "";
        const title = `${tv.name}${firstAirYear} | MovieFinder AI`;
        const description = tv.overview || `Discover ${tv.name} on MovieFinder AI.`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                images: tv.backdrop_path ? [TMDB_IMAGE_URL.backdrop(tv.backdrop_path)] : [],
            },
        };
    } catch {
        return { title: "MovieFinder AI" };
    }
}

export default async function TVPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { season, episode } = await searchParams;

    if (!id) return notFound();
    const tvId = parseInt(id, 10);
    if (!Number.isFinite(tvId)) return notFound();

    let tv;
    const seasonNum = season ? parseInt(season, 10) : undefined;
    let initialSeasonCast = undefined;

    try {
        const [tvData, seasonCastData] = await Promise.all([
            tvService.getTVDetails(tvId),
            seasonNum !== undefined && Number.isFinite(seasonNum)
                ? tvService.getTVSeasonCredits(tvId, seasonNum).catch(() => undefined)
                : Promise.resolve(undefined)
        ]);

        tv = tvData;
        initialSeasonCast = seasonCastData;

        if (!tv) return notFound();
    } catch (e: any) {
        if (e && typeof e === 'object' && 'digest' in e && typeof e.digest === 'string' && (e.digest.startsWith('NEXT_REDIRECT') || e.digest.startsWith('NEXT_NOT_FOUND'))) {
            throw e;
        }

        // Attempt to find if it's a Movie (handling broken legacy watchlist links)
        let movieCheck = null;
        try {
            movieCheck = await movieService.getMovieDetails(tvId);
        } catch {
            // Ignore API (404) errors for movie check
        }

        if (movieCheck) {
            redirect(`/movie/${id}`);
        }

        // Only return notFound() if TMDB explicitly returned a 404
        if (e?.status === 404) {
            return notFound();
        }

        console.error("TVPage error:", e);
        throw e;
    }

    return (
        <div className="min-h-screen relative">
            {/* Background Backdrop */}
            <div className="fixed inset-0 -z-10">
                <Image
                    src={TMDB_IMAGE_URL.backdrop(tv.backdrop_path)}
                    alt="backdrop"
                    fill
                    className="object-cover opacity-20 blur-sm"
                    priority
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>

            <div className="container mx-auto px-4 py-4 md:py-8 overflow-x-hidden">
                <BackButton label="Back" />

                <div className="grid md:grid-cols-[300px_1fr] gap-6 md:gap-8">
                    {/* Poster */}
                    <div className="relative aspect-[2/3] w-full max-w-[300px] rounded-xl overflow-hidden shadow-2xl mx-auto md:mx-0">
                        <Image
                            src={TMDB_IMAGE_URL.poster(tv.poster_path)}
                            alt={tv.name}
                            fill
                            className="object-cover"
                            priority
                            sizes="(max-width: 768px) 100vw, 300px"
                        />
                    </div>

                    {/* Details */}
                    <div className="space-y-4 md:space-y-6 min-w-0">
                        <div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 break-words leading-tight">{tv.name}</h1>
                            {tv.tagline && <p className="text-lg md:text-xl text-gray-400 italic leading-snug">{tv.tagline}</p>}
                        </div>

                        <MovieActions movie={tv as any} isSaved={false} isWatched={false} />

                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-300">
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                <span>{tv.vote_average.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                                <span>{tv.first_air_date}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Tv className="h-3.5 w-3.5 text-purple-400" />
                                <span>{tv.number_of_seasons}S • {tv.number_of_episodes}E</span>
                            </div>
                            {tv.episode_run_time?.[0] && (
                                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                    <Clock className="h-3.5 w-3.5 text-green-400" />
                                    <span>{tv.episode_run_time[0]}m / Ep</span>
                                </div>
                            )}
                            {tv.imdb_id && (
                                <a
                                    href={`https://www.imdb.com/title/${tv.imdb_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-[#f5c518] px-3 py-1.5 rounded-full border border-[#f5c518] text-black font-bold hover:bg-[#e2b616] transition-colors"
                                >
                                    <span className="text-[10px]">IMDb</span>
                                </a>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {tv.genres.map((g: any) => (
                                <span key={g.id} className="px-3 py-1 rounded-full border border-white/10 text-xs text-gray-300">
                                    {g.name}
                                </span>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-white">Overview</h3>
                            <p className="text-gray-300 leading-relaxed">{tv.overview}</p>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <WatchProviders
                                providers={tv.watch_providers}
                                tmdbId={tv.id}
                                mediaType="tv"
                                seasons={tv.seasons}
                                title={tv.name}
                                poster_path={tv.poster_path}
                                initialSeason={season ? parseInt(season) : undefined}
                                initialEpisode={episode ? parseInt(episode) : undefined}
                            />
                        </div>

                        {/* Season Ranking */}
                        <div className="pt-8 border-t border-white/10 relative min-h-[260px]">
                            <SeasonRankingSection title={tv.name} seasons={tv.seasons} />
                        </div>

                        {/* Seasons & Series Cast Tabs */}
                        <TVCastTabs
                            tvId={tv.id}
                            allCast={tv.cast || []}
                            seasons={tv.seasons || []}
                            initialSeason={seasonNum}
                            initialSeasonCast={initialSeasonCast}
                        />

                        {/* TV Reviews (AI Verdict & Reception) */}
                        <div className="space-y-4 pt-4 border-t border-white/10 relative min-h-[300px]">
                            <Suspense fallback={<ReviewsSectionSkeleton />}>
                                <TVReviews id={tv.id} title={tv.name} firstAirDate={tv.first_air_date} />
                            </Suspense>
                        </div>

                        {/* Similar Series (TMDB Source Recommendations) */}
                        <div className="space-y-4 pt-4 border-t border-white/10 relative min-h-[400px]">
                            <Suspense fallback={<MediaCardGridSkeleton />}>
                                <SourceRecommendations tmdbId={tv.id} type="tv" />
                            </Suspense>
                        </div>

                        {/* Similar Series (Live AI Recommendations) */}
                        <div className="space-y-4 pt-4 border-t border-white/10 relative min-h-[400px]">
                            <Suspense fallback={<AIRecommendationSectionSkeleton />}>
                                <SimilarMedia
                                    title={tv.name}
                                    overview={tv.overview}
                                    genres={tv.genres.map((g: any) => g.name)}
                                    type="tv"
                                    tmdbId={tv.id}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
