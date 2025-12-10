import { Movie } from "@/types/movie";
import { MovieCard } from "./movie-card";

export function WatchlistGrid({ movies }: { movies: Movie[] }) {
    if (movies.length === 0) {
        return (
            <div className="text-center py-20">
                <p className="text-xl text-gray-400">No movies found in your watchlist.</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or add some movies!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
            ))}
        </div>
    );
}
