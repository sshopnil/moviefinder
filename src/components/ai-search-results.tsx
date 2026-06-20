"use client";

import { useState, useEffect } from "react";
import { movieService, tvService } from "@/lib/tmdb";
import { getMoodRecommendationsAction, searchMoviesAction, searchMultiAction } from "@/app/actions";
import { MovieGrid } from "@/components/movie-grid";
import { Movie, TVSeries } from "@/types/movie";
import { BrainLoader } from "./brain-loader";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";

interface AISearchResultsProps {
    mood: string;
    type?: string;
    with_genres?: string;
}

// Helper to hydrate TMDB data on the client (or server via action)
// Since we are now in client component, we need to use the server action for searching or client side fetch if exposed.
// actions.ts has searchMoviesAction. We can use that.

export function AISearchResults({ mood, type, with_genres }: AISearchResultsProps) {
    const [processedItems, setProcessedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingText, setLoadingText] = useState("BRAIN IS BRAINING");

    useEffect(() => {
        if (!mood) return;

        let mounted = true;
        let timer: NodeJS.Timeout;

        async function fetchAndProcess() {
            setLoading(true);
            setError(null);
            setLoadingText("BRAIN IS BRAINING");

            timer = setTimeout(() => {
                if (mounted) setLoadingText("USING SEMANTIC SEARCH");
            }, 5000);

            try {
                // 1. Get AI Recommendations (Raw)
                const response = await getMoodRecommendationsAction(mood);
                const recommendations = response.data;

                if (!mounted) return;

                if (response.rateLimit) {
                    showAIRateLimitToast(response.rateLimit);
                    setProcessedItems([]);
                    setError("AI request limit reached.");
                    return;
                }

                if (!recommendations || recommendations.length === 0) {
                    setProcessedItems([]);
                    return;
                }

                // 2. Hydrate with TMDB Data
                // We need to call search for each item. 
                // Since this is client side, calling server actions in a loop is okay but might be slow.
                // Better to simple loop.

                const hydratedResults = await Promise.all(
                    recommendations.map(async (rec: any) => {
                        try {
                            // IMPROVEMENT: If the item is from fallback, it's already a full TMDB object.
                            // We can check if it has an ID and a known source, or just check fields.
                            // Fallback items have aiMeta.source === 'fallback' and usually have poster_path/id already.

                            if (rec.aiMeta?.source === 'fallback' && rec.id) {
                                return rec;
                            }

                            // Otherwise, it's a raw AI suggestion (Title + Type only), so we search.

                            let mediaData: any = null;
                            // Using server actions to avoid exposing API key on client if movieService uses it directly?
                            // movieService in lib/tmdb usually runs on server. 
                            // But here we imported it directly? No, we imported searchMoviesAction.
                            // Actually existing imports were: import { movieService, tvService } from "@/lib/tmdb";
                            // If we use movieService directly in "use client", it will fail if it uses process.env without NEXT_PUBLIC.
                            // So safest is to use server actions.

                            if (rec.type === "movie") {
                                // We need an action for searchMovies. imported searchMoviesAction.
                                const matches = await searchMoviesAction(rec.title);
                                mediaData = matches[0] ? { ...matches[0], media_type: "movie" } : null;
                            } else {
                                // We need an action for searchTV. Actions.ts usually has it? 
                                // Let's check imports. We have no searchTVAction exposed in actions.ts based on previous view.
                                // But we have searchMultiAction.
                                const matches = await searchMultiAction(rec.title);
                                // Try to find a TV match in multi search
                                const tvMatch = matches.tv.find((t: any) => t.name.toLowerCase().includes(rec.title.toLowerCase())) || matches.tv[0];
                                mediaData = tvMatch ? { ...tvMatch, media_type: "tv" } : null;
                            }

                            if (mediaData) {
                                return {
                                    ...mediaData,
                                    aiMeta: rec
                                };
                            }
                        } catch (e) {
                            console.error(`Failed to hydrate ${rec.title}`, e);
                        }
                        return null;
                    })
                );

                if (!mounted) return;

                const items = hydratedResults.filter(Boolean);

                // Deduplicate
                const seen = new Set();
                const uniqueItems = items.filter((item: any) => {
                    const key = `${item.media_type}-${item.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return item.poster_path; // Filter out items without posters
                });

                // Filter by type/genre if needed
                let finalItems = uniqueItems;
                if (type) {
                    finalItems = finalItems.filter((i: any) => i.media_type === type);
                }

                if (with_genres) {
                    const genreId = parseInt(with_genres);
                    finalItems = finalItems.filter((i: any) => i.genre_ids?.includes(genreId));
                }

                setProcessedItems(finalItems);

            } catch (err) {
                console.error("AI Search Process failed", err);
                if (mounted) setError("Failed to get recommendations.");
            } finally {
                if (mounted) setLoading(false);
                clearTimeout(timer);
            }
        }

        fetchAndProcess();

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, [mood, type, with_genres]);

    if (!mood) return null;

    if (loading) {
        return <BrainLoader variant="section" message={loadingText} />;
    }

    if (error) {
        return (
            <div className="text-center py-20 text-red-400">
                {error} Please try again.
            </div>
        );
    }

    if (processedItems.length === 0) {
        return (
            <div className="text-center py-20 text-gray-500">
                No results found for your mood. Try describing it differently.
            </div>
        );
    }

    return <MovieGrid movies={processedItems} title={`AI Recommendations for "${mood}"`} />;
}
