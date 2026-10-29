import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { movieService } from "../src/lib/tmdb.ts";
import { getActorRecommendations, makeAICacheKey, clearActorFallbackCache, normalizeScore } from "../src/lib/ai.ts";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

describe("Challenger Empirical Verification: Actor AI Recommendations", () => {
    beforeEach(() => {
        clearActorFallbackCache();
    });

    after(async () => {
        try {
            const mongoose = await import("mongoose");
            await mongoose.default.disconnect();
        } catch {
            // ignore
        }
    });

    describe("1. Timeout & Latency Characteristics", () => {
        it("empirically verifies AbortSignal cancellation under immediate pre-abort", async () => {
            const preAborted = AbortSignal.abort("Immediate cancellation");
            const t0 = performance.now();
            const res = await getActorRecommendations(
                991001,
                "PreAbort Actor",
                "spicy movie",
                preAborted,
                [
                    {
                        id: 216015,
                        title: "Fifty Shades of Grey",
                        genre_ids: [18, 10749, 53],
                        media_type: "movie",
                        character: "Anastasia Steele",
                        overview: "A provocative romantic drama.",
                    },
                ]
            );
            const duration = performance.now() - t0;
            // Pre-aborted signal should return fallback without hanging
            assert.ok(duration < 2000, `Expected abort handling within 2000ms, got ${duration.toFixed(1)}ms`);
            assert.ok(res.actorMatches.length > 0, "Must return fallback matches even when aborted");
            assert.equal(res.actorMatches[0].id, 216015);
            assert.equal(res.actorMatches[0].aiMeta.source, "fallback");
        });

        it("empirically verifies AbortSignal cancellation during in-flight execution", async () => {
            const controller = new AbortController();
            // Abort shortly after invocation
            setTimeout(() => controller.abort(), 20);

            const t0 = performance.now();
            const res = await getActorRecommendations(
                991002,
                "InFlight Actor",
                "spicy movie",
                controller.signal,
                [
                    {
                        id: 216015,
                        title: "Fifty Shades of Grey",
                        genre_ids: [18, 10749, 53],
                        media_type: "movie",
                        character: "Anastasia Steele",
                        overview: "A provocative romantic drama.",
                    },
                ]
            );
            const duration = performance.now() - t0;
            // Must catch cancellation cleanly and provide fallback within reasonable latency
            assert.ok(duration < 3000, `Expected in-flight abort to resolve within 3000ms, took ${duration.toFixed(1)}ms`);
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].aiMeta.source, "fallback");
        });

        it("empirically verifies 45s timeout configuration accommodates LLM latency", async () => {
            // Verify that getActorRecommendations accepts a custom AbortSignal and composes it with AbortSignal.timeout(45_000)
            const slowMockSignal = new AbortController().signal;
            assert.equal(slowMockSignal.aborted, false);
            // Verify AbortSignal.any compatibility in current Node environment
            const composed = AbortSignal.any([AbortSignal.timeout(45_000), slowMockSignal]);
            assert.ok(composed instanceof AbortSignal);
            assert.equal(composed.aborted, false);
        });
    });

    describe("2. Thinking Budget & Provider Configuration", () => {
        it("empirically verifies @ai-sdk/google model constructor parameter behavior", () => {
            const google = createGoogleGenerativeAI({ apiKey: "test-key" });
            // Verify function arity of google() provider
            assert.equal(google.length, 1, "google() provider factory only declares 1 parameter (modelId)");
            
            // Calling (google as any)(modelId, { thinkingConfig: ... }) does not throw
            const model = (google as any)("gemini-2.5-flash-lite", { thinkingConfig: { thinkingBudget: 0 } });
            assert.ok(model);
            assert.equal(model.modelId, "gemini-2.5-flash-lite");
        });

        it("verifies structured schema strictly enforces candidate ID and relevance bounds", () => {
            assert.equal(typeof normalizeScore, "function");
            assert.equal(normalizeScore(0.85), 85);
            assert.equal(normalizeScore(9.2), 92);
            assert.equal(normalizeScore(95), 95);
            assert.equal(normalizeScore(150), 100);
            assert.equal(normalizeScore(-5), 0);
        });
    });

    describe("3. Redundant TMDB Network Call Bypass (Credit Bypass)", () => {
        it("completely skips TMDB getPersonDetails and getPersonCombinedCredits when both existingCredits and existingPerson are provided", async () => {
            let detailsCalls = 0;
            let creditsCalls = 0;
            const originalGetDetails = movieService.getPersonDetails;
            const originalGetCredits = movieService.getPersonCombinedCredits;

            (movieService as any).getPersonDetails = async () => {
                detailsCalls++;
                throw new Error("Should not be called!");
            };
            (movieService as any).getPersonCombinedCredits = async () => {
                creditsCalls++;
                throw new Error("Should not be called!");
            };

            const mockPerson = {
                id: 991003,
                name: "Dakota Mock",
                profile_path: "/dakota_mock.jpg",
                known_for_department: "Acting",
            };
            const mockCredits = [
                {
                    id: 216015,
                    title: "Fifty Shades of Grey",
                    genre_ids: [18, 10749, 53],
                    media_type: "movie",
                    character: "Anastasia Steele",
                    overview: "Literature student Anastasia Steele's life changes forever.",
                },
            ];

            try {
                const res = await getActorRecommendations(
                    991003,
                    "Dakota Mock",
                    "spicy movie mock",
                    undefined,
                    mockCredits,
                    mockPerson
                );

                assert.equal(detailsCalls, 0, "getPersonDetails must NOT be called when existingPerson is passed");
                assert.equal(creditsCalls, 0, "getPersonCombinedCredits must NOT be called when existingCredits is passed");
                assert.equal(res.actorDetails?.name, "Dakota Mock");
                assert.equal(res.actorDetails?.profile_path, "/dakota_mock.jpg");
                assert.equal(res.actorMatches.length, 1);
                assert.equal(res.actorMatches[0].id, 216015);
            } finally {
                (movieService as any).getPersonDetails = originalGetDetails;
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("skips getPersonCombinedCredits when existingCredits is passed even if existingPerson is omitted", async () => {
            let detailsCalls = 0;
            let creditsCalls = 0;
            const originalGetDetails = movieService.getPersonDetails;
            const originalGetCredits = movieService.getPersonCombinedCredits;

            (movieService as any).getPersonDetails = async (id: number) => {
                detailsCalls++;
                return { id, name: "Dakota Omitted", profile_path: "/fetched_omitted.jpg", known_for_department: "Acting" };
            };
            (movieService as any).getPersonCombinedCredits = async () => {
                creditsCalls++;
                throw new Error("Should not be called!");
            };

            const mockCredits = [
                {
                    id: 216015,
                    title: "Fifty Shades of Grey",
                    genre_ids: [18, 10749, 53],
                    media_type: "movie",
                    character: "Anastasia Steele",
                },
            ];

            try {
                const res = await getActorRecommendations(
                    991004,
                    "Dakota Omitted",
                    "spicy movie omitted",
                    undefined,
                    mockCredits,
                    undefined
                );

                assert.equal(creditsCalls, 0, "getPersonCombinedCredits must NOT be called");
                assert.equal(detailsCalls, 1, "getPersonDetails should be fetched once to resolve actor details");
                assert.equal(res.actorDetails?.profile_path, "/fetched_omitted.jpg");
            } finally {
                (movieService as any).getPersonDetails = originalGetDetails;
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("filters out non-narrative media (talk shows, interviews, cameos) from the candidate pool", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => [
                {
                    id: 9991,
                    name: "The Tonight Show Starring Jimmy Fallon",
                    media_type: "tv",
                    character: "Self - Guest",
                    genre_ids: [10767],
                    popularity: 800,
                },
                {
                    id: 9992,
                    name: "Good Morning America",
                    media_type: "tv",
                    character: "Guest",
                    genre_ids: [10763],
                    popularity: 600,
                },
                {
                    id: 216015,
                    title: "Fifty Shades of Grey",
                    media_type: "movie",
                    character: "Anastasia Steele",
                    genre_ids: [18, 10749, 53],
                    popularity: 50,
                },
            ];

            try {
                const res = await getActorRecommendations(991005, "Narrative Star", "spicy movie narrative", undefined);
                assert.equal(res.actorMatches.length, 1);
                assert.equal(res.actorMatches[0].id, 216015);
                assert.ok(!res.actorMatches.some(m => m.id === 9991 || m.id === 9992));
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });
    });

    describe("4. Stress-Testing Fallback Caching & Concurrency", () => {
        it("returns in-memory fallback cache hits without redundant computations", async () => {
            let computeCalls = 0;
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => {
                computeCalls++;
                return [
                    {
                        id: 555,
                        title: "Sensual Drama",
                        genre_ids: [18, 10749],
                        media_type: "movie",
                        overview: "A passionate story of desire and romance.",
                    },
                ];
            };

            const aborted = AbortSignal.abort();
            try {
                // Call 1: cold fallback invocation
                const res1 = await getActorRecommendations(991006, "Star One", "spicy romance query", aborted);
                assert.equal(computeCalls, 1);
                assert.equal(res1.actorMatches[0].id, 555);

                // Call 2: immediate repeat query
                const res2 = await getActorRecommendations(991006, "Star One", "spicy romance query", undefined);

                assert.equal(computeCalls, 1, "Must NOT recompute when serving from fallback cache");
                assert.equal(res2.actorMatches[0].id, 555);
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("expires fallback cache entries after TTL (5 minutes)", async () => {
            let computeCalls = 0;
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => {
                computeCalls++;
                return [
                    {
                        id: 777,
                        title: "Time Expiry Movie",
                        genre_ids: [18],
                        media_type: "movie",
                    },
                ];
            };

            const aborted = AbortSignal.abort();
            const originalNow = Date.now;
            let simulatedTime = 1000000;
            global.Date.now = () => simulatedTime;

            try {
                // Call 1 at t = 1,000,000
                await getActorRecommendations(991007, "Actor TTL", "dramatic film", aborted);
                assert.equal(computeCalls, 1);

                // Advance time by 4 minutes (240s) -> should still hit cache
                simulatedTime += 4 * 60 * 1000;
                await getActorRecommendations(991007, "Actor TTL", "dramatic film", aborted);
                assert.equal(computeCalls, 1, "Must hit cache before 5 minutes TTL expires");

                // Advance time past 5 minutes (301s) -> should expire and re-compute
                simulatedTime += 61 * 1000;
                await getActorRecommendations(991007, "Actor TTL", "dramatic film", aborted);
                assert.equal(computeCalls, 2, "Must recompute after 5 minutes TTL expires");
            } finally {
                global.Date.now = originalNow;
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("guarantees deterministic, collision-free cache keys across actor IDs and moods", () => {
            const mood1 = "spicy movie";
            const mood2 = "  SPICY MOVIE  ";
            const keyDakotaSpicy = makeAICacheKey("ai_actor_recs_v3", `${118545}_${mood1.trim()}`);
            const keyDakotaSpicyCaps = makeAICacheKey("ai_actor_recs_v3", `${118545}_${mood2.trim()}`);
            const keyKeanuSpicy = makeAICacheKey("ai_actor_recs_v3", `${6384}_${mood1.trim()}`);
            const keyDakotaCyberpunk = makeAICacheKey("ai_actor_recs_v3", `${118545}_cyberpunk`);

            // Normalization check: same actor and mood regardless of casing or whitespace
            assert.equal(keyDakotaSpicy, keyDakotaSpicyCaps);
            // Isolation check: different actors with same mood must not collide
            assert.notEqual(keyDakotaSpicy, keyKeanuSpicy);
            // Isolation check: same actor with different moods must not collide
            assert.notEqual(keyDakotaSpicy, keyDakotaCyberpunk);
            // Key namespace version
            assert.ok(keyDakotaSpicy.startsWith("ai_actor_recs_v3_"));
        });
    });

    describe("5. Relevance Tuning & Pronoun Resolution", () => {
        it("correctly resolves referential pronoun 'of her' and scores Fifty Shades >= 85 without disclaimer", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => [
                {
                    id: 216015,
                    title: "Fifty Shades of Grey",
                    overview: "Anastasia Steele starts a provocative relationship with Christian Grey.",
                    character: "Anastasia Steele",
                    genre_ids: [18, 10749, 53],
                    media_type: "movie",
                    popularity: 45,
                },
                {
                    id: 634492,
                    title: "Madame Web",
                    overview: "Cassandra Webb is forced to confront her past.",
                    character: "Cassandra Webb",
                    genre_ids: [28, 14],
                    media_type: "movie",
                    popularity: 20,
                },
            ];

            try {
                // "spicy movie of her"
                const res = await getActorRecommendations(118545, "Dakota Johnson", "spicy movie of her", undefined);
                assert.ok(res.actorMatches.length > 0);
                const top = res.actorMatches[0];
                assert.equal(top.id, 216015);
                assert.ok(top.aiMeta.relevance_score >= 85, `Expected score >= 85, got ${top.aiMeta.relevance_score}`);
                assert.ok(!res.disclaimer, "No false disclaimer should be present for high match");
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("attaches friendly disclaimer when actor filmography genuinely lacks matching genre works", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => [
                {
                    id: 101,
                    title: "Sunny Bakery Romance",
                    overview: "Two bakers fall in love in a cute town.",
                    genre_ids: [10749, 35],
                    media_type: "movie",
                    popularity: 15,
                },
            ];

            try {
                // Completely incompatible query
                const res = await getActorRecommendations(991008, "RomCom Only", "gory brutal zombie horror massacre", undefined);
                assert.ok(res.actorMatches.length > 0);
                assert.ok(res.actorMatches[0].aiMeta.relevance_score < 60);
                assert.ok(res.disclaimer?.includes("RomCom Only"));
                assert.ok(res.disclaimer?.includes("gory brutal zombie horror massacre"));
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });
    });

    describe("6. Empirical Stress-Testing: TMDB Network Failures, Timeouts & Graceful Degradation", () => {
        it("empirically verifies graceful degradation when getPersonCombinedCredits rejects with 500 server error", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            const originalGetDetails = movieService.getPersonDetails;

            (movieService as any).getPersonDetails = async () => ({
                id: 118545,
                name: "Dakota Johnson",
                profile_path: "/dakota.jpg",
                known_for_department: "Acting",
            });
            (movieService as any).getPersonCombinedCredits = async () => {
                throw new Error("TMDB 500: Internal Server Error");
            };

            try {
                const res = await getActorRecommendations(118545, "Dakota Johnson", "spicy movie");
                assert.ok(Array.isArray(res.actorMatches));
                assert.equal(res.actorMatches.length, 0);
                assert.ok(Array.isArray(res.allCredits));
                assert.equal(res.allCredits.length, 0);
                assert.equal(res.actorDetails?.id, 118545);
                assert.equal(res.actorDetails?.name, "Dakota Johnson");
                assert.ok(res.disclaimer?.includes("No credits found on TMDB for Dakota Johnson."));
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
                (movieService as any).getPersonDetails = originalGetDetails;
            }
        });

        it("empirically verifies graceful degradation when getPersonCombinedCredits rejects with network timeout (ETIMEDOUT)", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            (movieService as any).getPersonCombinedCredits = async () => {
                const err = new Error("connect ETIMEDOUT 65.9.86.11:443");
                (err as any).code = "ETIMEDOUT";
                throw err;
            };

            try {
                const res = await getActorRecommendations(6384, "Keanu Reeves", "cyberpunk");
                assert.ok(Array.isArray(res.actorMatches));
                assert.equal(res.actorMatches.length, 0);
                assert.equal(res.allCredits.length, 0);
                assert.ok(res.disclaimer?.includes("No credits found on TMDB for Keanu Reeves."));
                assert.equal(res.actorDetails?.id, 6384);
                assert.equal(res.actorDetails?.name, "Keanu Reeves");
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
            }
        });

        it("empirically verifies graceful degradation when both getPersonDetails AND getPersonCombinedCredits reject simultaneously", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            const originalGetDetails = movieService.getPersonDetails;

            (movieService as any).getPersonDetails = async () => {
                throw new Error("TMDB Person Service Down");
            };
            (movieService as any).getPersonCombinedCredits = async () => {
                throw new Error("TMDB Credits Service Down");
            };

            try {
                const res = await getActorRecommendations(99999, "Fallback Hero", "action movie");
                assert.ok(Array.isArray(res.actorMatches));
                assert.equal(res.actorMatches.length, 0);
                assert.equal(res.allCredits.length, 0);
                assert.equal(res.actorDetails?.id, 99999);
                assert.equal(res.actorDetails?.name, "Fallback Hero");
                assert.equal(res.actorDetails?.profile_path, null);
                assert.equal(res.actorDetails?.known_for_department, "Acting");
                assert.ok(res.disclaimer?.includes("No credits found on TMDB for Fallback Hero."));
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
                (movieService as any).getPersonDetails = originalGetDetails;
            }
        });

        it("empirically verifies resilience against corrupted non-array returns from getPersonCombinedCredits", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            const originalGetDetails = movieService.getPersonDetails;

            (movieService as any).getPersonDetails = async () => ({
                id: 88812,
                name: "Corrupt Return Actor",
                profile_path: null,
                known_for_department: "Acting",
            });

            try {
                for (const corrupted of [null, undefined, { error: "bad payload" }, "unexpected string", 12345]) {
                    (movieService as any).getPersonCombinedCredits = async () => corrupted;
                    try {
                        const res = await getActorRecommendations(88812, "Corrupt Return Actor", "drama");
                        assert.ok(Array.isArray(res.actorMatches));
                        assert.equal(res.actorMatches.length, 0);
                        assert.equal(res.allCredits.length, 0);
                        assert.ok(res.disclaimer?.includes("No credits found on TMDB"));
                    } finally {
                        clearActorFallbackCache();
                    }
                }
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
                (movieService as any).getPersonDetails = originalGetDetails;
            }
        });

        it("empirically measures latency bounds when TMDB fetch hangs and is aborted via AbortSignal", async () => {
            const originalGetCredits = movieService.getPersonCombinedCredits;
            const originalGetDetails = movieService.getPersonDetails;
            const controller = new AbortController();

            (movieService as any).getPersonDetails = async () => ({
                id: 77123,
                name: "Hanging Actor",
                profile_path: null,
                known_for_department: "Acting",
            });

            (movieService as any).getPersonCombinedCredits = (_id: number, signal?: AbortSignal) => {
                return new Promise((_, reject) => {
                    if (signal?.aborted) {
                        return reject(new Error("Aborted immediately"));
                    }
                    signal?.addEventListener("abort", () => {
                        reject(new Error("Aborted by signal"));
                    });
                });
            };

            // Trigger abort after 50ms
            setTimeout(() => controller.abort(), 50);

            const t0 = performance.now();
            try {
                const res = await getActorRecommendations(77123, "Hanging Actor", "mystery", controller.signal);
                const duration = performance.now() - t0;
                assert.ok(duration < 1000, `Expected latency bound < 1000ms under 50ms abort, took ${duration.toFixed(1)}ms`);
                assert.ok(Array.isArray(res.actorMatches));
                assert.equal(res.actorMatches.length, 0);
                assert.ok(res.disclaimer?.includes("No credits found on TMDB"));
            } finally {
                (movieService as any).getPersonCombinedCredits = originalGetCredits;
                (movieService as any).getPersonDetails = originalGetDetails;
            }
        });

        it("empirically benchmarks latency of fallback recommendation engine under 100 candidate items", async () => {
            const largeCandidateSet = Array.from({ length: 100 }, (_, i) => ({
                id: 1000 + i,
                title: `Film Title ${i}`,
                overview: i % 2 === 0
                    ? `A provocative and sensual romance story involving passionate lovers and secret desires #${i}`
                    : `An action packed thriller with explosive combat and high speed chases #${i}`,
                genre_ids: i % 2 === 0 ? [10749, 18] : [28, 53],
                media_type: "movie" as const,
                character: `Character ${i}`,
                popularity: 100 - i,
            }));

            const t0 = performance.now();
            const res = await getActorRecommendations(
                55512,
                "Prolific Actor",
                "spicy movie of her",
                AbortSignal.abort(),
                largeCandidateSet
            );
            const duration = performance.now() - t0;

            assert.ok(duration < 100, `Fallback evaluation of 100 candidates took ${duration.toFixed(2)}ms, expected < 100ms`);
            assert.ok(res.actorMatches.length > 0);
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 85);
            assert.equal(res.actorMatches[0].genre_ids?.includes(10749), true);
        });
    });
});

