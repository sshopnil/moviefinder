
import { movieService } from "@/lib/tmdb";
import { getExternalRatings } from "@/lib/omdb";
import { getMovieVerdict } from "@/lib/ai";
import { Star, MessageSquare, Trophy, MonitorPlay, Sparkles } from "lucide-react";
import { GlassCard } from "./ui/glass-card";

interface MovieReviewsProps {
    id: number;
    title: string;
    releaseDate?: string;
}

export async function MovieReviews({ id, title, releaseDate }: MovieReviewsProps) {
    const year = releaseDate ? releaseDate.split("-")[0] : undefined;

    // Fetch data in parallel
    const [tmdbReviews, ratings] = await Promise.all([
        movieService.getMovieReviews(id),
        getExternalRatings(title, year)
    ]);

    // Get AI Verdict
    const verdict = await getMovieVerdict(title, ratings, tmdbReviews);

    if (tmdbReviews.length === 0 && !ratings) {
        return null;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-blue-400" />
                Reviews & Reception
            </h2>

            {/* AI Verdict */}
            {verdict && (
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-6 shadow-lg transform transition-all hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles className="h-24 w-24 text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                            <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider">AI Recommendation</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-white mb-2">{verdict.verdict}</h3>
                        <p className="text-lg text-gray-200 italic">"{verdict.reason}"</p>
                    </div>
                </div>
            )}

            {/* External Ratings (OMDb) */}
            {ratings && (
                <GlassCard className="bg-gradient-to-br from-gray-900/50 to-black/50 border-white/10 p-4 sm:p-6 mt-4">
                    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 items-start md:items-center justify-between">
                        <div className="space-y-1 sm:space-y-2">
                            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                                <MonitorPlay className="h-4 sm:h-5 w-4 sm:w-5 text-purple-400" />
                                External Ratings
                            </h2>
                            {ratings.awards && (
                                <p className="text-[11px] sm:text-sm text-yellow-400 flex items-center gap-1.5 leading-tight">
                                    <Trophy className="h-3 w-3 shrink-0" />
                                    {ratings.awards}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2 sm:gap-4 flex-wrap w-full md:w-auto">
                            {ratings.imdb && (
                                <div className="flex flex-col items-center bg-yellow-500/10 border border-yellow-500/20 p-2 sm:p-3 rounded-xl min-w-[80px] sm:min-w-[90px] flex-1 sm:flex-none">
                                    <span className="text-yellow-500 font-bold text-lg sm:text-xl">{ratings.imdb}</span>
                                    <span className="text-[9px] sm:text-[10px] text-yellow-500/80 uppercase tracking-wider font-medium">IMDb</span>
                                </div>
                            )}
                            {ratings.rottenTomatoes && (
                                <div className="flex flex-col items-center bg-red-500/10 border border-red-500/20 p-2 sm:p-3 rounded-xl min-w-[80px] sm:min-w-[90px] flex-1 sm:flex-none">
                                    <span className="text-red-500 font-bold text-lg sm:text-xl">{ratings.rottenTomatoes}</span>
                                    <span className="text-[9px] sm:text-[10px] text-red-500/80 uppercase tracking-wider font-medium">Rotten</span>
                                </div>
                            )}
                            {ratings.metacritic && (
                                <div className="flex flex-col items-center bg-green-500/10 border border-green-500/20 p-2 sm:p-3 rounded-xl min-w-[80px] sm:min-w-[90px] flex-1 sm:flex-none">
                                    <span className="text-green-500 font-bold text-lg sm:text-xl">{ratings.metacritic}</span>
                                    <span className="text-[9px] sm:text-[10px] text-green-500/80 uppercase tracking-wider font-medium">Metascore</span>
                                </div>
                            )}
                        </div>
                    </div>
                </GlassCard>
            )}

            {/* User Reviews (TMDB) */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">User Reviews</h3>
                {tmdbReviews.length > 0 ? (
                    <div className="grid gap-4">
                        {tmdbReviews.slice(0, 3).map((review: any) => (
                            <div key={review.id} className="bg-white/5 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-sm">
                                            {review.author[0].toUpperCase()}
                                        </div>
                                        <span className="font-medium text-white">{review.author}</span>
                                    </div>
                                    {review.author_details?.rating && (
                                        <div className="flex items-center gap-1 text-yellow-500 text-sm bg-yellow-500/10 px-2 py-1 rounded">
                                            <Star className="h-3 w-3 fill-yellow-500" />
                                            {review.author_details.rating}/10
                                        </div>
                                    )}
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                                    {review.content}
                                </p>
                                <a
                                    href={review.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Read full review on TMDB →
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">No user reviews available yet.</p>
                )}
            </div>
        </div>
    );
}
