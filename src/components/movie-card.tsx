import { Movie } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { Star } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

import Link from "next/link";

interface MovieCardProps {
    movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
    return (
        <Link href={`/movie/${movie.id}`}>
            <div
                className="group relative h-[400px] w-full cursor-pointer overflow-hidden rounded-xl bg-black/20"
            >
                <Image
                    src={TMDB_IMAGE_URL.poster(movie.poster_path)}
                    alt={movie.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />

                <div className="absolute bottom-0 left-0 w-full p-4 translate-y-2 transition-transform duration-300 group-hover:translate-y-0">
                    <h3 className="line-clamp-1 text-xl font-bold text-white mb-1">{movie.title}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-300">
                        <span className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            {movie.vote_average.toFixed(1)}
                        </span>
                        <span>{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-gray-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {movie.overview}
                    </p>
                </div>
            </div>
        </Link>
    );
}
