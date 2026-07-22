import { getSemanticMoodRecommendations, streamRecommendationsFromMood, streamSeasonRanking, streamSimilarContent, isAIRateLimitError } from "@/lib/ai";
import { movieService, tvService } from "@/lib/tmdb";
import { Movie, Season, TVSeries } from "@/types/movie";

export const runtime = "nodejs";

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
    const body = await request.json() as RequestBody;
    const mood = body.mood?.trim();
    const title = body.title?.trim();

    const missingContext = body.mode === "similar"
        ? !title
        : body.mode === "season-ranking"
            ? !title || !Array.isArray(body.seasons)
            : !mood;

    if (missingContext) {
        return Response.json({ error: "Recommendation context is required." }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: unknown) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            };
            const seen = new Set<string>();

            send({ type: "status", message: "Finding recommendations" });

            try {
                if (body.mode === "season-ranking") {
                    for await (const ranking of streamSeasonRanking(title!, body.seasons!)) {
                        send({ type: "item", item: ranking });
                    }
                    send({ type: "done" });
                    return;
                }

                const recommendations = body.mode === "similar"
                    ? streamSimilarContent(title!, body.overview || "", body.genres || [], body.sourceType || "tv", body.tmdbId)
                    : streamRecommendationsFromMood(mood!, {
                        page: body.page,
                        excludeTitles: body.excludeTitles,
                        mediaType: body.type,
                        refresh: body.refresh,
                    });

                for await (const recommendation of recommendations) {
                    if (seen.size >= 6) break;

                    try {
                        let media;

                        if (recommendation.aiMeta?.source === "fallback" && recommendation.id) {
                            media = recommendation;
                        } else {
                            const matches = await movieService.searchMulti(recommendation.title);
                            const match = selectExactTitle([...matches.movies, ...matches.tv], recommendation.title);
                            media = match
                                ? { ...match, media_type: "name" in match ? "tv" as const : "movie" as const }
                                : null;
                        }

                        if (!media?.poster_path) continue;
                        if (body.type && media.media_type !== body.type) continue;
                        if (body.with_genres && !media.genre_ids?.includes(Number(body.with_genres))) continue;

                        const key = `${media.media_type}-${media.id}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        const { aiMeta: recommendationMeta, ...recommendationData } = recommendation;
                        send({
                            type: "item",
                            item: {
                                ...media,
                                aiMeta: {
                                    ...recommendationData,
                                    source: recommendationMeta?.source || "ai",
                                },
                            },
                        });
                    } catch (error) {
                        console.error(`Failed to hydrate ${recommendation.title}:`, error);
                    }
                }

                if (seen.size === 0) {
                    let fallbackItems;

                    if (body.mode === "similar" && body.tmdbId) {
                        fallbackItems = body.sourceType === "movie"
                            ? await movieService.getSimilar(body.tmdbId)
                            : await tvService.getSimilar(body.tmdbId);
                    } else if (mood) {
                        fallbackItems = await getSemanticMoodRecommendations(mood, body.page);
                    } else if (body.with_genres) {
                        if (body.type === "movie") {
                            fallbackItems = (await movieService.getDiscover({ with_genres: body.with_genres })).results;
                        } else if (body.type === "tv") {
                            fallbackItems = (await tvService.getDiscover({ with_genres: body.with_genres })).results;
                        } else {
                            const [movies, tv] = await Promise.all([
                                movieService.getDiscover({ with_genres: body.with_genres }),
                                tvService.getDiscover({ with_genres: body.with_genres }),
                            ]);
                            fallbackItems = [...movies.results.slice(0, 5), ...tv.results.slice(0, 5)];
                        }
                    } else if (body.type === "movie") {
                        fallbackItems = await movieService.getPopular();
                    } else if (body.type === "tv") {
                        fallbackItems = await tvService.getPopular();
                    } else {
                        const [movies, tv] = await Promise.all([
                            movieService.getPopular(),
                            tvService.getPopular(),
                        ]);
                        fallbackItems = [...movies.slice(0, 5), ...tv.slice(0, 5)];
                    }

                    for (const media of fallbackItems) {
                        if (!media.poster_path) continue;
                        if (body.with_genres && !media.genre_ids?.includes(Number(body.with_genres))) continue;

                        const mediaType = media.media_type === "tv" ? "tv" : "movie";
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
                                },
                            },
                        });

                        if (seen.size >= 6) break;
                    }
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
                controller.close();
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
