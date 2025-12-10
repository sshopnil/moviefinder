import { movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { ArrowLeft, Calendar, Clock, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieActions } from "@/components/movie-actions";
import { getWatchlistStatusAction } from "@/actions/watchlist";

// Use generic 'params' type handling available in newer Next.js versions or simple awaitable
type Props = {
    params: Promise<{ id: string }>;
};

export default async function MoviePage({ params }: Props) {
    const { id } = await params;

    if (!id) return notFound();

    let movie;
    let isSaved = false;

    try {
        movie = await movieService.getMovieDetails(parseInt(id));
        isSaved = await getWatchlistStatusAction(parseInt(id));
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
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>

            <div className="container mx-auto px-4 py-8">
                <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Search
                </Link>

                <div className="grid md:grid-cols-[300px_1fr] gap-8">
                    {/* Poster */}
                    <div className="relative aspect-[2/3] w-full max-w-[300px] rounded-xl overflow-hidden shadow-2xl mx-auto md:mx-0">
                        <Image
                            src={TMDB_IMAGE_URL.poster(movie.poster_path)}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>

                    {/* Details */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{movie.title}</h1>
                            <p className="text-xl text-gray-400 italic">{movie.tagline}</p>
                        </div>

                        <MovieActions movie={movie} isSaved={isSaved} />

                        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                            <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span>{movie.vote_average.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                <Calendar className="h-4 w-4" />
                                <span>{movie.release_date}</span>
                            </div>
                            <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                <Clock className="h-4 w-4" />
                                <span>{movie.runtime} min</span>
                            </div>
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
                            <h3 className="text-lg font-semibold text-white">Top Cast</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {movie.cast.map((actor: any) => (
                                    <div key={actor.id} className="text-center">
                                        <div className="relative w-full aspect-square rounded-full overflow-hidden mb-2 mx-auto max-w-[100px] bg-white/5">
                                            {actor.profile_path ? (
                                                <Image
                                                    src={TMDB_IMAGE_URL.profile(actor.profile_path)}
                                                    alt={actor.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-500">No Image</div>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-white truncate">{actor.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{actor.character}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
