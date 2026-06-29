import { getSourceRecommendationsAction } from "@/app/actions";
import { MovieCard } from "@/components/movie-card";
import { Database } from "lucide-react";

interface SourceRecommendationsProps {
    tmdbId: number;
    type: "movie" | "tv";
}

export async function SourceRecommendations({ tmdbId, type }: SourceRecommendationsProps) {
    const recommendations = await getSourceRecommendationsAction(type, tmdbId);

    if (recommendations.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6 py-6">
            <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
                    <Database className="h-5 w-5 text-cyan-300" />
                    Source Recommendations
                </h2>
                <p className="text-sm text-gray-400">
                    Similar {type === "movie" ? "movies" : "series"} from TMDB. No AI or semantic search used.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {recommendations.slice(0, 5).map(item => (
                    <MovieCard key={`${type}:${item.id}`} movie={item} />
                ))}
            </div>
        </div>
    );
}
