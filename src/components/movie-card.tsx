import { CardWatchedOverlay } from "@/components/card-watched-overlay";
import { Movie, TVSeries } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { Star, PlayCircle } from "lucide-react";
import Image from "@/components/ui/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface MovieCardProps {
    movie: Movie | TVSeries;
}

export function MovieCard({ movie }: MovieCardProps) {
    const isTV = 'name' in movie;
    const title = isTV ? (movie as TVSeries).name : (movie as Movie).title;
    const date = isTV ? (movie as TVSeries).first_air_date : (movie as Movie).release_date;
    const href = isTV ? `/tv/${movie.id}` : `/movie/${movie.id}`;

    return (
        <Link href={href} className="block w-full min-w-0">
            <div
                className="group relative h-[260px] xs:h-[280px] sm:h-[400px] w-full cursor-pointer overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/5 transition-all hover:ring-white/20"
            >
                <Image
                    src={TMDB_IMAGE_URL.poster(movie.poster_path)}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 400px) 100vw, (max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                    priority={movie.popularity > 1000} // Prioritize popular items for faster LCP
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-90" />

                <CardWatchedOverlay movie={movie as any} />

                {/* Hover Play Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-90 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
                    <PlayCircle className="h-12 w-12 text-blue-500 fill-blue-500/20" />
                </div>

                <div className="absolute bottom-0 left-0 w-full p-4 transform transition-transform duration-300">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                            {isTV ? 'TV' : 'Movie'}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-500">
                            <Star className="h-3 w-3 fill-yellow-500" />
                            {movie.vote_average.toFixed(1)}
                        </span>
                    </div>
                    <h3 className="line-clamp-1 text-sm sm:text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight w-full truncate">{title}</h3>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                        <span>{date ? new Date(date).getFullYear() : 'N/A'}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">Click to View</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
