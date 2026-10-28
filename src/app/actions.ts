"use server";

import { movieService, tvService } from "@/lib/tmdb";
import { AIRateLimitInfo, getMovieInsights, isAIRateLimitError } from "@/lib/ai";
import { getExternalRatings } from "@/lib/omdb";
import type { ExternalRatings } from "@/lib/omdb";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { Movie, TVSeries } from "@/types/movie";

type AIActionResult<T> = {
    data: T;
    rateLimit?: AIRateLimitInfo;
};

export async function searchMultiAction(query: string, page: number = 1) {
    const clientIp = await getClientIp();
    const rate = checkRateLimit(`search-action:${clientIp}`, 30, 60 * 1000);
    if (!rate.allowed) {
        return { movies: [], tv: [], people: [], total_pages: 0, total_results: 0 };
    }

    try {
        return await movieService.searchMulti(query, page);
    } catch (error) {
        console.error("Failed to multi search:", error);
        return { movies: [], tv: [], people: [], total_pages: 0, total_results: 0 };
    }
}

export async function getSourceRecommendationsAction(type: "movie" | "tv", tmdbId: number) {
    try {
        const results = type === "movie"
            ? await movieService.getSimilar(tmdbId)
            : await tvService.getSimilar(tmdbId);

        return results
            .filter(item => item.id !== tmdbId)
            .slice(0, 10)
            .map(item => ({
                ...item,
                media_type: type,
            }));
    } catch (error) {
        console.error("Failed to get source recommendations:", error);
        return [];
    }
}

export async function getMediaVerdictAction(
    mediaType: "movie" | "tv",
    id: number,
    title: string,
    releaseDate?: string,
    initialRatings?: ExternalRatings | null,
    initialReviews?: { content?: string }[]
): Promise<AIActionResult<any | null>> {
    const clientIp = await getClientIp();
    const rate = checkRateLimit(`verdict-action:${clientIp}`, 10, 60 * 1000);
    if (!rate.allowed) {
        return {
            data: null,
            rateLimit: {
                limit: 10,
                count: 10,
                retryAfterSeconds: rate.retryAfterSeconds,
                resetAt: rate.resetAt,
            },
        };
    }

    try {
        const year = releaseDate ? releaseDate.split("-")[0] : undefined;

        const [reviewsResult, ratingsResult] = await Promise.allSettled([
            initialReviews !== undefined
                ? Promise.resolve(initialReviews)
                : (mediaType === "movie" ? movieService.getMovieReviews(id) : tvService.getTVReviews(id)),
            initialRatings !== undefined
                ? Promise.resolve(initialRatings)
                : getExternalRatings(title, year),
        ]);

        const reviews = reviewsResult.status === "fulfilled" ? reviewsResult.value : [];
        const ratings = ratingsResult.status === "fulfilled" ? ratingsResult.value : null;

        const data = await getMovieInsights(id, title, ratings, reviews);
        const rateLimit = data?.aiMeta?.source === "rate_limited" ? data.aiMeta.rateLimit : undefined;

        return { data, rateLimit };
    } catch (error) {
        if (isAIRateLimitError(error)) {
            return { data: null, rateLimit: error.rateLimit };
        }

        console.error("Failed to get AI verdict:", error);
        return { data: null };
    }
}

