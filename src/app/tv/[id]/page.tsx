import { tvService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { BackButton } from "@/components/back-button";
import { Calendar, Clock, Star, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { logViewAction } from "@/actions/history";
import { MovieActions } from "@/components/movie-actions";
import { getWatchlistStatusAction } from "@/actions/watchlist";
import { MovieSection } from "@/components/movie-section";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function TVPage({ params }: Props) {
    const { id } = await params;

    if (!id) return notFound();

    let tv;
    let similar;
    let savedStatus = false;
    let watchedStatus = false;

    try {
        tv = await tvService.getTVDetails(parseInt(id));
        similar = await tvService.getSimilar(parseInt(id));

        if (!tv) return notFound();

        // Log view
        logViewAction({
            id: tv.id,
            type: 'tv' as const,
            title: tv.name,
            poster_path: tv.poster_path
        }).catch(e => console.error("Failed to log view:", e));

        const status = await getWatchlistStatusAction(parseInt(id));
        if (status) {
            savedStatus = status.isSaved;
            watchedStatus = status.isWatched;
        }
    } catch (e) {
        console.error(e);
        return notFound();
    }

    const totalRuntime = tv.episode_run_time?.[0] ? tv.episode_run_time[0] * tv.number_of_episodes : 0;

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
                    unoptimized // Optimization for image loading
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

                        <MovieActions movie={tv as any} isSaved={savedStatus} isWatched={watchedStatus} />

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

                        {/* Seasons */}
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <h3 className="text-lg font-semibold text-white">Seasons</h3>
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                {tv.seasons.map((season) => (
                                    <div key={season.id} className="min-w-[150px] space-y-2 group">
                                        <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-white/5">
                                            {season.poster_path ? (
                                                <Image
                                                    src={TMDB_IMAGE_URL.poster(season.poster_path)}
                                                    alt={season.name}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform"
                                                    sizes="150px"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-500 text-center p-2">No Poster</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white truncate">{season.name}</p>
                                            <p className="text-xs text-gray-400">{season.episode_count} Episodes</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cast */}
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <h3 className="text-lg font-semibold text-white">Top Cast</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {tv.cast.map((actor: any) => (
                                    <Link key={actor.id} href={`/person/${actor.id}`} className="text-center group block">
                                        <div className="relative w-full aspect-square rounded-full overflow-hidden mb-2 mx-auto max-w-[100px] bg-white/5 group-hover:ring-2 ring-white/20 transition-all">
                                            {actor.profile_path ? (
                                                <Image
                                                    src={TMDB_IMAGE_URL.profile(actor.profile_path)}
                                                    alt={actor.name}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform"
                                                    sizes="100px"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-500">No Image</div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{actor.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{actor.character}</p>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {similar && similar.length > 0 && (
                            <div className="pt-8 border-t border-white/10">
                                <MovieSection
                                    title="Similar Series"
                                    movies={similar.map(s => ({ ...s, title: s.name, release_date: s.first_air_date } as any))}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
