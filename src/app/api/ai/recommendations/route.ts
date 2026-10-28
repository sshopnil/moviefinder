import { getSemanticMoodRecommendations, streamRecommendationsFromMood, streamSeasonRanking, streamSimilarContent, isAIRateLimitError, getAIRateLimitInfo } from "@/lib/ai";
import { matchesGenreFilter, getGenreIdForDiscover } from "@/lib/genres";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateRequestOrigin } from "@/lib/security";
import { movieService, tvService } from "@/lib/tmdb";
import { Movie, Season, TVSeries } from "@/types/movie";

export const runtime = "nodejs";

export async function GET(request?: Request) {
    let clientIp: string;
    try {
        clientIp = await getClientIp();
    } catch {
        clientIp = "anonymous";
    }
    if (clientIp === "anonymous" && request) {
        const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
        if (forwarded) clientIp = forwarded.split(",")[0].trim();
    }

    const ipLimit = checkRateLimit(`ai-rec-get:${clientIp}`, 60, 60 * 1000);
    if (!ipLimit.allowed) {
        return Response.json(
            { error: "Too many requests. Please wait a moment." },
            {
                status: 429,
                headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
            }
        );
    }

    return Response.json({
        rateLimit: getAIRateLimitInfo(),
    });
}

type RequestBody = {
    mode?: "mood" | "similar" | "season-ranking";
    mood?: string;
    title?: string;
    overview?: string;
    genres?: string[];
    sourceType?: "movie" | "tv";
    tmdbId?: number;
    seasons?: Season[];
    page?: number;
    excludeTitles?: string[];
    refresh?: boolean;
    type?: string;
    with_genres?: string;
};

function normalizeTitle(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function selectExactTitle<T extends Movie | TVSeries>(matches: T[], requestedTitle: string) {
    const requested = normalizeTitle(requestedTitle);
    return matches.find((match) => {
        const title = "name" in match ? match.name : match.title;
        return normalizeTitle(title) === requested;
    });
}

export async function POST(request: Request) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    if (!validateRequestOrigin(host, origin, referer, true)) {
        return Response.json({ error: "Invalid origin" }, { status: 403 });
    }

    const clientIp = await getClientIp();
    const ipLimit = checkRateLimit(`ai-rec:${clientIp}`, 25, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
        return Response.json(
            { error: "Too many AI recommendation requests. Please wait a few minutes." },
            {
                status: 429,
                headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
            }
        );
    }

    let body: RequestBody;
    try {
        body = (await request.json()) as RequestBody;
    } catch {
        if (request.signal.aborted) {
            return new Response(null, { status: 499 });
        }
        return Response.json({ error: "Invalid or empty JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
        return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    const mood = body.mood?.trim().slice(0, 250);
    const title = body.title?.trim().slice(0, 200);
    const overview = (body.overview || "").slice(0, 1500);
    const genres = Array.isArray(body.genres) ? body.genres.slice(0, 10) : [];
    const excludeTitles = Array.isArray(body.excludeTitles) ? body.excludeTitles.slice(-30) : undefined;
    const seasons = Array.isArray(body.seasons) ? body.seasons.slice(0, 40) : undefined;

    const missingContext = body.mode === "similar"
        ? !title
        : body.mode === "season-ranking"
            ? !title || !seasons
            : !mood;

    if (missingContext) {
        return Response.json({ error: "Recommendation context is required." }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: unknown) => {
                if (request.signal.aborted) return;
                try {
                    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                } catch {
                    // Stream may have been closed or aborted
                }
            };
            const seen = new Set<string>();
            let usedFallback = false;

            send({ type: "status", message: "Finding recommendations" });

            try {
                if (body.mode === "season-ranking") {
                    for await (const ranking of streamSeasonRanking(title!, seasons!, request.signal)) {
                        if (request.signal.aborted) break;
                        send({ type: "item", item: ranking });
                    }
                    send({ type: "done" });
                    return;
                }

                const recommendations = body.mode === "similar"
                    ? streamSimilarContent(title!, overview, genres, body.sourceType || "tv", body.tmdbId, request.signal)
                    : streamRecommendationsFromMood(mood!, {
                        page: body.page,
                        excludeTitles,
                        mediaType: body.type,
                        refresh: body.refresh,
                        signal: request.signal,
                    });

                const hydrateRecommendation = async (recommendation: any) => {
                    try {
                        let media;

                        if ((recommendation.aiMeta?.source === "fallback" || recommendation.aiMeta?.source === "rate_limited") && recommendation.id) {
                            usedFallback = true;
                            media = recommendation;
                        } else {
                            const matches = await movieService.searchMulti(recommendation.title, 1, request.signal);
                            const preferredType = body.type || (recommendation.type === "tv" ? "tv" : recommendation.type === "movie" ? "movie" : undefined);
                            let match: Movie | TVSeries | null | undefined = null;
                            if (preferredType === "tv") {
                                match = selectExactTitle(matches.tv, recommendation.title) || selectExactTitle(matches.movies, recommendation.title);
                            } else if (preferredType === "movie") {
                                match = selectExactTitle(matches.movies, recommendation.title) || selectExactTitle(matches.tv, recommendation.title);
                            } else {
                                const movieMatch = selectExactTitle(matches.movies, recommendation.title);
                                const tvMatch = selectExactTitle(matches.tv, recommendation.title);
                                if (movieMatch && tvMatch) {
                                    match = (tvMatch.popularity || 0) > (movieMatch.popularity || 0) ? tvMatch : movieMatch;
                                } else {
                                    match = movieMatch || tvMatch;
                                }
                            }
                            media = match
                                ? { ...match, media_type: "name" in match ? ("tv" as const) : ("movie" as const) }
                                : null;
                        }

                        return { media, recommendation };
                    } catch (error) {
                        console.error(`Failed to hydrate ${recommendation.title}:`, error);
                        return null;
                    }
                };

                const hydrationTasks: Promise<{ media: any; recommendation: any } | null>[] = [];

                for await (const recommendation of recommendations) {
                    if (request.signal.aborted) break;
                    hydrationTasks.push(hydrateRecommendation(recommendation));
                    if (hydrationTasks.length >= 10) break;
                }

                const hydratedResults = await Promise.all(hydrationTasks);

                for (const result of hydratedResults) {
                    if (request.signal.aborted || seen.size >= 6) break;
                    if (!result) continue;

                    const { media, recommendation } = result;
                    if (!media?.poster_path) continue;
                    if (body.type && media.media_type !== body.type) continue;
                    if (body.with_genres && !matchesGenreFilter(media.genre_ids, body.with_genres, media.media_type)) continue;

                    const key = `${media.media_type}-${media.id}`;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    const { aiMeta: recommendationMeta, ...recommendationData } = recommendation;
                    const isFallbackItem = recommendationMeta?.source === "fallback" || recommendationMeta?.source === "rate_limited";
                    if (isFallbackItem) {
                        usedFallback = true;
                    }

                    send({
                        type: "item",
                        item: {
                            ...media,
                            aiMeta: {
                                ...recommendationData,
                                source: recommendationMeta?.source || "ai",
                                rateLimit: recommendationMeta?.rateLimit || (isFallbackItem ? getAIRateLimitInfo() : undefined),
                            },
                        },
                    });

                    if (seen.size >= 6) break;
                }

                if (seen.size === 0 && !request.signal.aborted) {
                    usedFallback = true;
                    let fallbackItems: (Movie | TVSeries)[] = [];

                    if (body.with_genres) {
                        if (body.type === "movie") {
                            fallbackItems = (await movieService.getDiscover({ with_genres: getGenreIdForDiscover(body.with_genres, "movie") }, request.signal)).results;
                        } else if (body.type === "tv") {
                            fallbackItems = (await tvService.getDiscover({ with_genres: getGenreIdForDiscover(body.with_genres, "tv") }, request.signal)).results;
                        } else {
                            const [movies, tv] = await Promise.all([
                                movieService.getDiscover({ with_genres: getGenreIdForDiscover(body.with_genres, "movie") }, request.signal),
                                tvService.getDiscover({ with_genres: getGenreIdForDiscover(body.with_genres, "tv") }, request.signal),
                            ]);
                            fallbackItems = [...movies.results.slice(0, 5), ...tv.results.slice(0, 5)];
                        }
                    } else if (body.type === "movie") {
                        fallbackItems = await movieService.getPopular(request.signal);
                    } else if (body.type === "tv") {
                        fallbackItems = await tvService.getPopular(request.signal);
                    } else {
                        const [movies, tv] = await Promise.all([
                            movieService.getPopular(request.signal),
                            tvService.getPopular(request.signal),
                        ]);
                        fallbackItems = [...movies.slice(0, 5), ...tv.slice(0, 5)];
                    }

                    for (const media of fallbackItems) {
                        if (!media.poster_path) continue;
                        const mediaType = media.media_type === "tv" ? "tv" : "movie";
                        if (body.with_genres && !matchesGenreFilter(media.genre_ids, body.with_genres, mediaType)) continue;
                        const key = `${mediaType}-${media.id}`;
                        if (seen.has(key)) continue;
                        seen.add(key);

                        const mediaTitle = "name" in media ? media.name : media.title;
                        send({
                            type: "item",
                            item: {
                                ...media,
                                media_type: mediaType,
                                aiMeta: {
                                    title: mediaTitle,
                                    type: mediaType,
                                    relevance_score: 75,
                                    reason: "",
                                    target_audience: "",
                                    why_watch: "",
                                    ending_mood: "",
                                    emotional_impact: "",
                                    critics_consensus: "",
                                    source: "fallback",
                                    rateLimit: getAIRateLimitInfo(),
                                },
                            },
                        });

                        if (seen.size >= 6) break;
                    }
                }

                if (usedFallback) {
                    send({
                        type: "quota",
                        rateLimit: getAIRateLimitInfo(),
                        isSemantic: true,
                    });
                }

                send({ type: "done" });
            } catch (error) {
                if (isAIRateLimitError(error)) {
                    send({ type: "rateLimit", rateLimit: error.rateLimit });
                } else {
                    console.error("AI recommendation stream failed:", error);
                    send({ type: "error", message: "Failed to get recommendations." });
                }
            } finally {
                try {
                    controller.close();
                } catch {
                    // Safely ignore if controller is already closed
                }
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    });
}
