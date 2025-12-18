import { movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { BackButton } from "@/components/back-button";
import { ArrowLeft, Calendar, Clock, Star } from "lucide-react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { logViewAction } from "@/actions/history";
import { MovieActions } from "@/components/movie-actions";
import { getWatchlistStatusAction } from "@/actions/watchlist";
import { Suspense } from "react";
import { MediaGalleryLoader } from "@/components/media-gallery-loader";
import { MediaGallerySkeleton } from "@/components/media-gallery-skeleton";


// Use generic 'params' type handling available in newer Next.js versions or simple awaitable
type Props = {
    params: Promise<{ id: string }>;
};

export default async function MoviePage({ params }: Props) {
    const { id } = await params;

    if (!id) return notFound();

    let movie;

    let savedStatus = false;
    let watchedStatus = false;

    try {
        movie = await movieService.getMovieDetails(parseInt(id));

        if (!movie) return notFound();

        // Log view
        logViewAction({
            id: movie.id,
            type: 'movie',
            title: movie.title,
            poster_path: movie.poster_path
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

    return (
        <div className="min-h-screen relative">
            {/* Background Backdrop */}
            <div className="fixed inset-0 -z-10">
                <Image
                    src={TMDB_IMAGE_URL.backdrop(movie.backdrop_path)}
                    alt="backdrop"
                    fill
                    className="object-cover opacity-20 blur-sm"
                    sizes="100vw"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>

            <div className="container mx-auto px-4 py-4 md:py-8 overflow-x-hidden">
                <BackButton label="Back" />

                <div className="grid md:grid-cols-[300px_1fr] gap-6 md:gap-8">
                    {/* Poster */}
                    <div className="relative aspect-[2/3] w-full max-w-[300px] rounded-xl overflow-hidden shadow-2xl mx-auto md:mx-0">
                        <Image
                            src={TMDB_IMAGE_URL.poster(movie.poster_path)}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 300px"
                            priority
                        />
                    </div>

                    {/* Details */}
                    <div className="space-y-4 md:space-y-6 min-w-0">
                        <div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 break-words leading-tight">{movie.title}</h1>
                            <p className="text-lg md:text-xl text-gray-400 italic leading-snug">{movie.tagline}</p>
                        </div>

                        <MovieActions movie={movie} isSaved={savedStatus} isWatched={watchedStatus} />

                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-300">
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                <span>{movie.vote_average.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                                <span>{movie.release_date}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <Clock className="h-3.5 w-3.5 text-green-400" />
                                <span>{movie.runtime}m</span>
                            </div>
                            {movie.imdb_id && (
                                <a
                                    href={`https://www.imdb.com/title/${movie.imdb_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-[#f5c518] px-3 py-1.5 rounded-full border border-[#f5c518] text-black font-bold hover:bg-[#e2b616] transition-colors"
                                >
                                    <span className="text-[10px]">IMDb</span>
                                </a>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {movie.genres.map((g: any) => (
                                <span key={g.id} className="px-3 py-1 rounded-full border border-white/10 text-xs text-gray-300">
                                    {g.name}
                                </span>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-white">Overview</h3>
                            <p className="text-gray-300 leading-relaxed">{movie.overview}</p>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <Suspense fallback={<MediaGallerySkeleton />}>
                                <MediaGalleryLoader id={movie.id} />
                            </Suspense>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <h3 className="text-lg font-semibold text-white">Top Cast</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {movie.cast.map((actor: any) => (
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
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <MovieReviews id={movie.id} title={movie.title} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { MovieReviews } from "@/components/movie-reviews";
