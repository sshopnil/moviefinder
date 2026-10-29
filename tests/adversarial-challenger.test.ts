import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { movieService } from "../src/lib/tmdb.ts";
import { getActorRecommendations, clearActorFallbackCache } from "../src/lib/ai.ts";

describe("Adversarial Verification: Actor AI Prompt & Filtering", () => {
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

    // -------------------------------------------------------------------------
    // 1. DAKOTA JOHNSON "SPICY MOVIE" / "SPICY MOVIE OF HER" & FIFTY SHADES
    // -------------------------------------------------------------------------
    describe("1. Dakota Johnson 'spicy movie' & 'spicy movie of her' (Task 1 & 3)", () => {
        const dakotaFilmography = [
            {
                id: 216015,
                title: "Fifty Shades of Grey",
                character: "Anastasia Steele",
                overview: "Literature student Anastasia Steele's life changes forever when she meets handsome, yet tormented billionaire Christian Grey.",
                genre_ids: [18, 10749, 53], // Drama, Romance, Thriller
                media_type: "movie",
                popularity: 30.5,
                vote_average: 5.9,
            },
            {
                id: 341174,
                title: "Fifty Shades Darker",
                character: "Anastasia Steele",
                overview: "When a wounded Christian Grey tries to entice a cautious Ana Steele back into his life, she demands a new arrangement.",
                genre_ids: [18, 10749],
                media_type: "movie",
                popularity: 11.4,
                vote_average: 6.5,
            },
            {
                id: 337167,
                title: "Fifty Shades Freed",
                character: "Anastasia Steele",
                overview: "Believing they have left behind shadowy figures from their past, newlyweds Christian and Ana fully embrace an inextricable connection.",
                genre_ids: [18, 10749],
                media_type: "movie",
                popularity: 18.5,
                vote_average: 6.7,
            },
            {
                id: 361292,
                title: "Suspiria",
                character: "Susie Bannion",
                overview: "A darkness swirls at the center of a world-renowned dance company, one that will engulf the artistic director, an ambitious young dancer, and a grieving psychotherapist.",
                genre_ids: [27, 9648, 18], // Horror, Mystery, Drama
                media_type: "movie",
                popularity: 7.1,
                vote_average: 6.9,
            },
            {
                id: 634492,
                title: "Madame Web",
                character: "Cassandra Webb",
                overview: "Forced to confront revelations about her past, paramedic Cassandra Webb must protect three young women from a deadly adversary.",
                genre_ids: [28, 14], // Action, Fantasy
                media_type: "movie",
                popularity: 10.0,
                vote_average: 5.4,
            },
            {
                id: 1489,
                name: "Jimmy Kimmel Live!",
                character: "Self - Guest",
                genre_ids: [10767, 35], // Talk, Comedy
                media_type: "tv",
                popularity: 102.0,
            },
        ];

        it("ranks Fifty Shades of Grey as top recommendation with score >= 85 and Fifty Shades Darker >= 80 for 'spicy movie'", async () => {
            const res = await getActorRecommendations(
                118545,
                "Dakota Johnson",
                "spicy movie",
                AbortSignal.abort(), // Test deterministic fallback oracle
                dakotaFilmography
            );

            assert.ok(res.actorMatches.length > 0, "Must return matches");
            const top = res.actorMatches[0];
            assert.equal(top.id, 216015, "Top match must be Fifty Shades of Grey");
            assert.ok(top.aiMeta.relevance_score >= 85, `Score must be >= 85, got ${top.aiMeta.relevance_score}`);
            const darker = res.actorMatches.find(m => m.id === 341174);
            assert.ok(darker, "Fifty Shades Darker must be present");
            assert.ok(darker.aiMeta.relevance_score >= 80, `Darker score must be >= 80, got ${darker.aiMeta.relevance_score}`);
            assert.ok(!res.disclaimer, "Must NOT emit false disclaimer when strong match exists");
        });

        it("ranks Fifty Shades of Grey with score >= 85 and Fifty Shades Darker >= 80 for referential 'spicy movie of her'", async () => {
            const res = await getActorRecommendations(
                118545,
                "Dakota Johnson",
                "spicy movie of her",
                AbortSignal.abort(),
                dakotaFilmography
            );

            assert.ok(res.actorMatches.length > 0, "Must return matches");
            const top = res.actorMatches[0];
            assert.equal(top.id, 216015, "Fifty Shades of Grey must be top match");
            assert.ok(top.aiMeta.relevance_score >= 85, `Score must be >= 85, got ${top.aiMeta.relevance_score}`);
            const darker = res.actorMatches.find(m => m.id === 341174);
            assert.ok(darker, "Fifty Shades Darker must be present");
            assert.ok(darker.aiMeta.relevance_score >= 80, `Darker score must be >= 80, got ${darker.aiMeta.relevance_score}`);
            assert.ok(!res.disclaimer, "Must NOT emit false disclaimer for 'spicy movie of her'");
        });
    });

    // -------------------------------------------------------------------------
    // 2. REFERENTIAL PRONOUNS ("of her", "of him", "starring her", "with them")
    // -------------------------------------------------------------------------
    describe("2. Referential Pronoun Handling (Task 1)", () => {
        const mixedCredits = [
            {
                id: 501,
                title: "Passionate Encounters",
                overview: "A steamy romantic entanglement develops between two strangers.",
                genre_ids: [10749, 18],
                character: "Lead",
                media_type: "movie",
                popularity: 25,
            },
            {
                id: 502,
                title: "Cold Case Mystery",
                overview: "A gritty investigation into a serial murder.",
                genre_ids: [80, 53],
                character: "Detective",
                media_type: "movie",
                popularity: 20,
            },
        ];

        const pronounVariations = [
            "spicy movie of her",
            "steamy romance starring her",
            "spicy romance of him",
            "passionate movie with him",
            "sensual films starring them",
            "steamy movie with them",
            "erotic romance featuring her",
            "give me spicy movies by her",
        ];

        for (const query of pronounVariations) {
            it(`resolves query '${query}' to the romance credit without stop-word degradation`, async () => {
                const res = await getActorRecommendations(
                    991001,
                    "Actor Pronoun Test",
                    query,
                    AbortSignal.abort(),
                    mixedCredits
                );

                assert.ok(res.actorMatches.length > 0);
                assert.equal(res.actorMatches[0].id, 501, `Failed to prioritize romantic film for query: ${query}`);
                assert.ok(
                    res.actorMatches[0].aiMeta.relevance_score >= 80,
                    `Expected score >= 80, got ${res.actorMatches[0].aiMeta.relevance_score} for query: ${query}`
                );
            });
        }
    });

    // -------------------------------------------------------------------------
    // 3. BROAD MOOD VIBES ("dark comedy", "mind-bending", "tearjerker", "action")
    // -------------------------------------------------------------------------
    describe("3. Broad Mood Vibes (Task 1)", () => {
        const diverseCredits = [
            {
                id: 701,
                title: "Hilariously Grim",
                overview: "A pitch-black comedy about a cynical hitman who joins an absurd community theater.",
                genre_ids: [35, 80], // Comedy, Crime
                character: "Hitman",
                media_type: "movie",
                popularity: 40,
            },
            {
                id: 702,
                title: "Fractured Dimensions",
                overview: "A reality-bending psychological simulation where memories and virtual illusions collide.",
                genre_ids: [878, 53, 9648], // Sci-Fi, Thriller, Mystery
                character: "Dr. Mind",
                media_type: "movie",
                popularity: 50,
            },
            {
                id: 703,
                title: "A Heartbreaking Solace",
                overview: "A poignant emotional drama about profound grief, loss, and tragic parting of loved ones.",
                genre_ids: [18, 10749], // Drama, Romance
                character: "Widow",
                media_type: "movie",
                popularity: 35,
            },
            {
                id: 704,
                title: "Adrenaline Bullet",
                overview: "An explosive action combat thriller featuring high-octane martial arts and gun chases.",
                genre_ids: [28, 12, 53], // Action, Adventure, Thriller
                character: "Operative",
                media_type: "movie",
                popularity: 60,
            },
        ];

        it("matches 'dark comedy' to comedy/crime satire with high score", async () => {
            const res = await getActorRecommendations(
                992001,
                "Mood Test Actor",
                "dark comedy",
                AbortSignal.abort(),
                diverseCredits
            );
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].id, 701, "Top match must be Hilariously Grim");
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 70);
        });

        it("matches 'mind-bending' to sci-fi/psychological thriller with high score", async () => {
            const res = await getActorRecommendations(
                992001,
                "Mood Test Actor",
                "mind-bending",
                AbortSignal.abort(),
                diverseCredits
            );
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].id, 702, "Top match must be Fractured Dimensions");
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 70);
        });

        it("matches 'tearjerker' to poignant emotional drama with high score", async () => {
            const res = await getActorRecommendations(
                992001,
                "Mood Test Actor",
                "tearjerker",
                AbortSignal.abort(),
                diverseCredits
            );
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].id, 703, "Top match must be A Heartbreaking Solace");
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 70);
        });

        it("matches 'action' to adrenaline combat thriller with high score", async () => {
            const res = await getActorRecommendations(
                992001,
                "Mood Test Actor",
                "action",
                AbortSignal.abort(),
                diverseCredits
            );
            assert.ok(res.actorMatches.length > 0);
            assert.equal(res.actorMatches[0].id, 704, "Top match must be Adrenaline Bullet");
            assert.ok(res.actorMatches[0].aiMeta.relevance_score >= 70);
        });

        it("matches Keanu Reeves 'cyberpunk' to The Matrix with score >= 85 purely on genre and synopsis tokens", async () => {
            const keanuCredits = [
                {
                    id: 603,
                    title: "The Matrix",
                    character: "Thomas A. Anderson / Neo",
                    overview: "Set in the 22nd century, The Matrix tells the story of a computer hacker who learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
                    genre_ids: [878, 28], // Sci-Fi, Action
                    media_type: "movie",
                    popularity: 65.0,
                    vote_average: 8.2,
                },
                {
                    id: 245891,
                    title: "John Wick",
                    character: "John Wick",
                    overview: "An ex-hitman comes out of retirement to track down the gangsters that took everything from him.",
                    genre_ids: [28, 53], // Action, Thriller
                    media_type: "movie",
                    popularity: 45.0,
                    vote_average: 7.4,
                },
                {
                    id: 393,
                    title: "Sweet November",
                    character: "Nelson Moss",
                    overview: "An advertising executive has a romantic encounter with an eccentric woman who promises to change his life in one month.",
                    genre_ids: [18, 10749], // Drama, Romance
                    media_type: "movie",
                    popularity: 15.0,
                    vote_average: 6.8,
                },
                {
                    id: 9901,
                    name: "The Graham Norton Show",
                    character: "Self - Guest",
                    genre_ids: [10767, 35],
                    media_type: "tv",
                    popularity: 90.0,
                },
            ];

            const res = await getActorRecommendations(
                6384,
                "Keanu Reeves",
                "cyberpunk",
                AbortSignal.abort(),
                keanuCredits
            );

            assert.ok(res.actorMatches.length > 0);
            const matrix = res.actorMatches.find(m => m.id === 603);
            assert.ok(matrix, "The Matrix must be returned");
            assert.equal(res.actorMatches[0].id, 603, "The Matrix must be top recommendation");
            assert.ok(matrix.aiMeta.relevance_score >= 85, `The Matrix score must be >= 85, got ${matrix.aiMeta.relevance_score}`);
            assert.ok(!res.disclaimer, "No false disclaimer when match score >= 85");
            assert.ok(!res.actorMatches.some(m => m.id === 9901), "Graham Norton Show must be excluded");
        });
    });

    // -------------------------------------------------------------------------
    // 4. NON-NARRATIVE APPEARANCES FILTERING (Task 2)
    // -------------------------------------------------------------------------
    describe("4. Non-Narrative Appearances Filtering (Task 2)", () => {
        it("strictly excludes talk shows and interviews from ranking when narrative works exist", async () => {
            const mixedCredits = [
                {
                    id: 101,
                    name: "The Tonight Show Starring Jimmy Fallon",
                    character: "Self - Guest",
                    genre_ids: [10767, 35],
                    media_type: "tv",
                    popularity: 400.0,
                },
                {
                    id: 102,
                    name: "The Ellen DeGeneres Show",
                    character: "Self",
                    genre_ids: [10767],
                    media_type: "tv",
                    popularity: 350.0,
                },
                {
                    id: 103,
                    name: "Good Morning America",
                    character: "Guest",
                    genre_ids: [10763],
                    media_type: "tv",
                    popularity: 300.0,
                },
                {
                    id: 104,
                    name: "Academy Awards Red Carpet",
                    character: "Presenter",
                    genre_ids: [10764],
                    media_type: "tv",
                    popularity: 250.0,
                },
                {
                    id: 105,
                    title: "Sensual Romance",
                    character: "Chloe",
                    overview: "A steamy romantic connection sparks between two artists.",
                    genre_ids: [10749, 18],
                    media_type: "movie",
                    popularity: 15.0,
                },
            ];

            const res = await getActorRecommendations(
                993001,
                "Celebrity Star",
                "spicy movie",
                AbortSignal.abort(),
                mixedCredits
            );

            assert.ok(res.actorMatches.length > 0);
            // Top match MUST be the narrative movie, despite much lower popularity (15 vs 400)
            assert.equal(res.actorMatches[0].id, 105);
            // None of the non-narrative entries should be in actorMatches
            const matchedIds = res.actorMatches.map(m => m.id);
            assert.ok(!matchedIds.includes(101), "Tonight Show must be excluded");
            assert.ok(!matchedIds.includes(102), "Ellen Show must be excluded");
            assert.ok(!matchedIds.includes(103), "Good Morning America must be excluded");
            assert.ok(!matchedIds.includes(104), "Awards show must be excluded");
        });

        it("safely falls back without crash when actor has ONLY non-narrative credits", async () => {
            const talkHostCredits = [
                {
                    id: 201,
                    name: "The Late Night Talk Show",
                    character: "Self - Host",
                    genre_ids: [10767],
                    media_type: "tv",
                    popularity: 300,
                },
                {
                    id: 202,
                    name: "Celebrity Interview Special",
                    character: "Host",
                    genre_ids: [10763],
                    media_type: "tv",
                    popularity: 200,
                },
            ];

            const res = await getActorRecommendations(
                993002,
                "Talk Show Host",
                "funny comedy",
                AbortSignal.abort(),
                talkHostCredits
            );

            // Should not crash, and gracefully return results
            assert.ok(Array.isArray(res.actorMatches));
            assert.equal(res.allCredits.length, 2);
        });
    });

    // -------------------------------------------------------------------------
    // 5. EMPTY AND NONSENSICAL QUERY HANDLING (Task 4)
    // -------------------------------------------------------------------------
    describe("5. Empty & Nonsensical Query Handling (Task 4)", () => {
        const sampleCredits = [
            {
                id: 301,
                title: "Standard Movie",
                overview: "A simple drama about daily life in a small town.",
                genre_ids: [18],
                character: "Protagonist",
                media_type: "movie",
                popularity: 20,
            },
        ];

        it("returns empty result immediately for empty string", async () => {
            const res = await getActorRecommendations(994001, "Test Actor", "", AbortSignal.abort(), sampleCredits);
            assert.deepEqual(res, { actorMatches: [], allCredits: [] });
        });

        it("returns empty result immediately for whitespace string", async () => {
            const res = await getActorRecommendations(994001, "Test Actor", "   \t\n  ", AbortSignal.abort(), sampleCredits);
            assert.deepEqual(res, { actorMatches: [], allCredits: [] });
        });

        it("returns empty result for NaN actorId or empty actorName", async () => {
            const res1 = await getActorRecommendations(NaN, "Test Actor", "action", AbortSignal.abort(), sampleCredits);
            assert.deepEqual(res1, { actorMatches: [], allCredits: [] });

            const res2 = await getActorRecommendations(994001, "   ", "action", AbortSignal.abort(), sampleCredits);
            assert.deepEqual(res2, { actorMatches: [], allCredits: [] });
        });

        it("handles completely nonsensical query safely and attaches low-match disclaimer", async () => {
            const res = await getActorRecommendations(
                994002,
                "Test Actor",
                "xkjqwpmz 998811 !@#$%",
                AbortSignal.abort(),
                sampleCredits
            );

            assert.ok(Array.isArray(res.actorMatches));
            // Relevance score should be baseline/low
            const maxScore = Math.max(...res.actorMatches.map(m => m.aiMeta.relevance_score));
            assert.ok(maxScore < 60, `Expected low match score for nonsensical query, got ${maxScore}`);
            // Disclaimer should be attached indicating no strong match
            assert.ok(res.disclaimer, "Disclaimer must be present when maxScore < 60");
            assert.ok(res.disclaimer.includes("No works strongly match"));
        });

        it("handles extremely long adversarial query safely without crash or buffer overflow", async () => {
            const longQuery = "spicy movie ".repeat(100); // 1200 characters
            const res = await getActorRecommendations(
                994003,
                "Test Actor",
                longQuery,
                AbortSignal.abort(),
                sampleCredits
            );

            assert.ok(Array.isArray(res.actorMatches));
            assert.ok(res.actorMatches.length > 0);
        });
    });
});
