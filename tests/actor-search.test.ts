import { describe, it, beforeEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import { movieService } from "../src/lib/tmdb.ts";
import { getActorRecommendations, makeAICacheKey, clearActorFallbackCache } from "../src/lib/ai.ts";

describe("Actor Search & Filmography Integration", () => {
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
    it("generates deterministic cache keys for actor AI queries", () => {
        const key1 = makeAICacheKey("ai_actor_recs_v1", "6384_cyberpunk dystopian");
        const key2 = makeAICacheKey("ai_actor_recs_v1", "6384_CYBERPUNK DYSTOPIAN ");
        assert.equal(key1, key2);
        assert.ok(key1.startsWith("ai_actor_recs_v1_"));
    });

    it("returns empty results safely when actorId or mood are invalid", async () => {
        const emptyIdResult = await getActorRecommendations(NaN, "Keanu Reeves", "sci-fi");
        assert.deepEqual(emptyIdResult, { actorMatches: [], allCredits: [] });

        const emptyMoodResult = await getActorRecommendations(6384, "Keanu Reeves", "   ");
        assert.deepEqual(emptyMoodResult, { actorMatches: [], allCredits: [] });

        const emptyNameResult = await getActorRecommendations(6384, "  ", "sci-fi");
        assert.deepEqual(emptyNameResult, { actorMatches: [], allCredits: [] });
    });

    it("evaluates and hydrates actor credits properly with semantic fallback", async () => {
        // Mock getPersonCombinedCredits and getPersonDetails to return sample data for testing
        const originalGetCredits = movieService.getPersonCombinedCredits;
        const originalGetPersonDetails = movieService.getPersonDetails;

        (movieService as any).getPersonDetails = async (id: number) => ({
            id,
            name: "Test Actor",
            profile_path: "/test_profile.jpg",
            known_for_department: "Acting",
        });

        (movieService as any).getPersonCombinedCredits = async () => [
            {
                id: 603,
                title: "The Matrix",
                overview: "A computer hacker learns from mysterious rebels about the true nature of his reality.",
                poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
                backdrop_path: "/7u3BgWi1GvK8wWvHw4Yy4jFh03R.jpg",
                release_date: "1999-03-30",
                vote_average: 8.2,
                popularity: 90.5,
                media_type: "movie",
            },
            {
                id: 205,
                name: "Cyberpunk: Edgerunners",
                overview: "A street kid trying to survive in a technology and body modification-obsessed city.",
                poster_path: "/5jZE9y5Tz0J4w9R2b9j3m3N8B7.jpg",
                backdrop_path: "/5jZE9y5Tz0J4w9R2b9j3m3N8B8.jpg",
                first_air_date: "2022-09-13",
                vote_average: 8.6,
                popularity: 75.2,
                media_type: "tv",
            },
            {
                id: 100,
                title: "Sweet November",
                overview: "A workaholic executive and an unconventional woman share a passionate romance.",
                poster_path: "/sweet.jpg",
                backdrop_path: "/sweet_bg.jpg",
                release_date: "2001-02-16",
                vote_average: 6.8,
                popularity: 30.1,
                media_type: "movie",
            },
        ];

        try {
            const res = await getActorRecommendations(99999999, "Test Actor", "cyberpunk reality hack", undefined);

            assert.ok(Array.isArray(res.actorMatches));
            assert.ok(Array.isArray(res.allCredits));
            assert.equal(res.allCredits.length, 3);
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorDetails?.profile_path, "/test_profile.jpg");

            // Matrix should rank high because of "reality" and "hacker"
            const topMatch = res.actorMatches[0];
            assert.ok(topMatch.aiMeta);
            assert.ok(typeof topMatch.aiMeta.relevance_score === "number");
            assert.ok(topMatch.aiMeta.reason.length > 0);
            assert.ok(["movie", "tv"].includes(topMatch.media_type || "movie"));
            assert.equal(topMatch.match_score, topMatch.aiMeta.relevance_score);
            assert.equal(topMatch.relevance_score, topMatch.aiMeta.relevance_score);
            assert.equal(topMatch.reason, topMatch.aiMeta.reason);
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
            (movieService as any).getPersonDetails = originalGetPersonDetails;
        }
    });

    it("attaches low score disclaimer when no actor titles strongly match the requested vibe", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => [
            {
                id: 101,
                title: "Romance in Paris",
                overview: "A charming love story in Paris between two pastry chefs.",
                poster_path: "/paris.jpg",
                backdrop_path: "/paris_bg.jpg",
                release_date: "2015-05-01",
                vote_average: 6.5,
                popularity: 20.0,
                media_type: "movie",
            },
        ];

        try {
            // Search for something completely mismatched: brutal slasher gore
            const res = await getActorRecommendations(88888888, "RomCom Star", "gory brutal zombie horror massacre", undefined);

            assert.ok(res.actorMatches.length > 0);
            // Verify disclaimer is present because score is low
            if (res.disclaimer) {
                assert.ok(res.disclaimer.includes("RomCom Star"));
            }
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("handles an actor with no TMDB credits gracefully", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => [];

        try {
            const res = await getActorRecommendations(77777777, "Unknown Person", "sci-fi action", undefined);
            assert.equal(res.actorMatches.length, 0);
            assert.equal(res.allCredits.length, 0);
            assert.ok(res.disclaimer?.includes("No credits found"));
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("deduplicates multiple credits for the exact same TV or movie entry", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => [
            {
                id: 2224,
                name: "The Daily Show",
                first_air_date: "1996-07-22",
                media_type: "tv",
                popularity: 50.0,
                character: "Self - Guest",
            },
            {
                id: 2224,
                name: "The Daily Show",
                first_air_date: "1996-07-22",
                media_type: "tv",
                popularity: 45.0,
                character: "Self - Co-Host",
            },
        ];

        try {
            const res = await getActorRecommendations(12345, "Guest Star", "comedy talk show", undefined);
            // Should be deduplicated into a single entry
            assert.equal(res.allCredits.length, 1);
            assert.equal(res.allCredits[0].id, 2224);
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("pre-filters non-narrative talk shows and self appearances from top candidate pool", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => [
            {
                id: 9001,
                name: "Late Night Talk Show",
                media_type: "tv",
                character: "Self - Guest",
                genre_ids: [10767],
                popularity: 500,
            },
            {
                id: 9002,
                name: "Morning News Interview",
                media_type: "tv",
                character: "Guest",
                genre_ids: [10763],
                popularity: 450,
            },
            {
                id: 501,
                title: "Sensual Affair",
                media_type: "movie",
                character: "Elena",
                overview: "A passionate erotic romance between two lovers.",
                genre_ids: [10749, 18],
                popularity: 25,
            },
        ];

        try {
            const res = await getActorRecommendations(888118, "Indie Romance Star", "spicy movie", undefined);
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].id, 501);
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 85);
            // Non-narrative talk shows should not crowd out the romance match
            const talkShowMatch = res.actorMatches.find(m => m.id === 9001 || m.id === 9002);
            assert.equal(talkShowMatch, undefined);
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("uses pre-fetched existingCredits and existingPerson without calling movieService", async () => {
        let creditsCalls = 0;
        let detailsCalls = 0;
        const originalGetCredits = movieService.getPersonCombinedCredits;
        const originalGetPersonDetails = movieService.getPersonDetails;

        (movieService as any).getPersonCombinedCredits = async () => {
            creditsCalls++;
            return [];
        };
        (movieService as any).getPersonDetails = async () => {
            detailsCalls++;
            return null;
        };

        const existingCredits = [
            {
                id: 216015,
                title: "Fifty Shades of Grey",
                overview: "Literature student Anastasia Steele's life changes forever when she meets handsome billionaire Christian Grey.",
                character: "Anastasia Steele",
                genre_ids: [18, 10749, 53],
                media_type: "movie",
                popularity: 30,
            },
        ];
        const existingPerson = {
            id: 118545,
            name: "Dakota Johnson",
            profile_path: "/dakota.jpg",
            known_for_department: "Acting",
        };

        try {
            const res = await getActorRecommendations(
                118545,
                "Dakota Johnson",
                "spicy movie of her",
                undefined,
                existingCredits,
                existingPerson
            );
            assert.equal(creditsCalls, 0, "Should not call getPersonCombinedCredits when existingCredits provided");
            assert.equal(detailsCalls, 0, "Should not call getPersonDetails when existingPerson provided");
            assert.equal(res.actorDetails?.name, "Dakota Johnson");
            assert.equal(res.actorMatches.length, 1);
            assert.equal(res.actorMatches[0].id, 216015);
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 85);
            assert.ok(!res.disclaimer, "Must not emit false disclaimer when score >= 85");
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
            (movieService as any).getPersonDetails = originalGetPersonDetails;
        }
    });

    it("evaluates 'spicy movie' and 'spicy movie of her' for Dakota Johnson (118545) returning Fifty Shades with score >= 85 and no false disclaimer", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => [
            {
                id: 216015,
                title: "Fifty Shades of Grey",
                overview: "Anastasia Steele starts a provocative relationship with Christian Grey.",
                character: "Anastasia Steele",
                genre_ids: [18, 10749, 53],
                media_type: "movie",
                popularity: 30.5,
            },
            {
                id: 341174,
                title: "Fifty Shades Darker",
                overview: "Anastasia confronts the anger and envy of women who came before her.",
                character: "Anastasia Steele",
                genre_ids: [18, 10749],
                media_type: "movie",
                popularity: 11.4,
            },
            {
                id: 634492,
                title: "Madame Web",
                overview: "Cassandra Webb is forced to confront her past while trying to survive.",
                character: "Cassandra Webb",
                genre_ids: [28, 14],
                media_type: "movie",
                popularity: 10.0,
            },
            {
                id: 9999,
                name: "Late Show with David Letterman",
                character: "Self - Guest",
                genre_ids: [10767],
                media_type: "tv",
                popularity: 150.0,
            },
        ];

        try {
            // Test 1: "spicy movie"
            const res1 = await getActorRecommendations(118545, "Dakota Johnson", "spicy movie", undefined);
            assert.ok(res1.actorMatches.length > 0);
            const topMatch1 = res1.actorMatches[0];
            assert.equal(topMatch1.id, 216015);
            assert.ok(topMatch1.aiMeta.relevance_score >= 85, `Expected score >= 85, got ${topMatch1.aiMeta.relevance_score}`);
            assert.ok(!res1.disclaimer, "Should not emit disclaimer for strong match");

            // Test 2: "spicy movie of her" (pronoun interpretation)
            const res2 = await getActorRecommendations(118545, "Dakota Johnson", "spicy movie of her", undefined);
            assert.ok(res2.actorMatches.length > 0);
            const topMatch2 = res2.actorMatches[0];
            assert.equal(topMatch2.id, 216015);
            assert.ok(topMatch2.aiMeta.relevance_score >= 85, `Expected score >= 85, got ${topMatch2.aiMeta.relevance_score}`);
            assert.ok(!res2.disclaimer, "Should not emit disclaimer for strong match");
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("caches fallback results with TTL so repeated queries return immediately", async () => {
        let callCount = 0;
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async () => {
            callCount++;
            return [
                {
                    id: 7001,
                    title: "Action Thriller",
                    character: "Agent",
                    overview: "An agent pursues revenge in explosive combat.",
                    genre_ids: [28, 53],
                    media_type: "movie",
                    popularity: 40,
                },
            ];
        };

        const abortedSignal = AbortSignal.abort();
        try {
            const res1 = await getActorRecommendations(999111, "Action Star", "explosive combat agent action", abortedSignal);
            assert.equal(callCount, 1);
            assert.ok(res1.actorMatches.length > 0);
            assert.equal(res1.actorMatches[0].aiMeta?.source, "fallback");

            // Immediate repeat query with same parameters
            const res2 = await getActorRecommendations(999111, "Action Star", "explosive combat agent action", undefined);
            // Should be served from fallback cache without re-fetching TMDB or calling AI
            assert.equal(callCount, 1);
            assert.equal(res2.actorMatches[0].id, 7001);
            assert.equal(res2.actorMatches[0].aiMeta?.source, "fallback");
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });

    it("handles TMDB getPersonCombinedCredits rejection gracefully without throwing", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        const originalGetDetails = movieService.getPersonDetails;

        (movieService as any).getPersonDetails = async () => ({
            id: 88888,
            name: "Faulty Network Actor",
            profile_path: null,
            known_for_department: "Acting",
        });
        (movieService as any).getPersonCombinedCredits = async () => {
            throw new Error("TMDB network timeout or 500 Internal Server Error");
        };

        try {
            const res = await getActorRecommendations(88888, "Faulty Network Actor", "spicy comedy");
            assert.ok(Array.isArray(res.actorMatches));
            assert.equal(res.actorMatches.length, 0);
            assert.ok(Array.isArray(res.allCredits));
            assert.equal(res.allCredits.length, 0);
            assert.ok(res.disclaimer?.includes("No credits found on TMDB"));
            assert.equal(res.actorDetails?.id, 88888);
            assert.equal(res.actorDetails?.name, "Faulty Network Actor");
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
            (movieService as any).getPersonDetails = originalGetDetails;
        }
    });

    it("handles aborted signal gracefully when existingCredits is omitted", async () => {
        const originalGetCredits = movieService.getPersonCombinedCredits;
        (movieService as any).getPersonCombinedCredits = async (_id: number, signal?: AbortSignal) => {
            if (signal?.aborted) {
                const err = new Error("The operation was aborted");
                err.name = "AbortError";
                throw err;
            }
            return [];
        };

        try {
            const aborted = AbortSignal.abort();
            const res = await getActorRecommendations(77777, "Aborted Query Actor", "action hero", aborted);
            assert.ok(Array.isArray(res.actorMatches));
            assert.equal(res.actorMatches.length, 0);
            assert.ok(res.disclaimer?.includes("No credits found on TMDB"));
        } finally {
            (movieService as any).getPersonCombinedCredits = originalGetCredits;
        }
    });
});


