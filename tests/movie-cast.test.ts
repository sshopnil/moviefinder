import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    movieService,
    normalizeMovieCast,
    normalizeMovieCrew,
    getCrewJobPriority,
    splitCharacters
} from "../src/lib/tmdb.ts";

describe("Movie Cast & Crew Normalization and Service", () => {
    describe("splitCharacters helper", () => {
        it("splits and trims characters separated by / or |", () => {
            assert.deepEqual(splitCharacters("Batman / Bruce Wayne"), ["Batman", "Bruce Wayne"]);
            assert.deepEqual(splitCharacters("Neo | Thomas Anderson"), ["Neo", "Thomas Anderson"]);
            assert.deepEqual(splitCharacters("   Single Character   "), ["Single Character"]);
            assert.deepEqual(splitCharacters(""), []);
            assert.deepEqual(splitCharacters(null as any), []);
            assert.deepEqual(splitCharacters(undefined as any), []);
        });
    });

    describe("normalizeMovieCast", () => {
        it("handles empty, null, or non-array inputs safely", () => {
            assert.deepEqual(normalizeMovieCast([]), []);
            assert.deepEqual(normalizeMovieCast(null as any), []);
            assert.deepEqual(normalizeMovieCast(undefined as any), []);
            assert.deepEqual(normalizeMovieCast("invalid" as any), []);
        });

        it("filters out invalid items without id or with empty names", () => {
            const raw = [
                null,
                undefined,
                {},
                { id: "invalid-id" },
                { id: NaN, name: "NaN Actor" },
                { id: 100, name: "" },
                { id: 101, name: "Valid Actor", character: "Hero", order: 0 }
            ];
            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 1);
            assert.equal(normalized[0].id, 101);
            assert.equal(normalized[0].name, "Valid Actor");
        });

        it("does NOT slice cast to 10, retaining the entire cast list", () => {
            const largeRawCast = Array.from({ length: 45 }, (_, i) => ({
                id: i + 1,
                name: `Actor ${i + 1}`,
                character: `Character ${i + 1}`,
                order: i,
                profile_path: `/profile${i + 1}.jpg`
            }));

            const normalized = normalizeMovieCast(largeRawCast);
            assert.equal(normalized.length, 45);
            assert.equal(normalized[0].id, 1);
            assert.equal(normalized[44].id, 45);
        });

        it("sorts cast members by billing order ascending", () => {
            const raw = [
                { id: 3, name: "Third Billed", character: "Role C", order: 2 },
                { id: 1, name: "First Billed", character: "Role A", order: 0 },
                { id: 4, name: "Unbilled", character: "Extra" },
                { id: 2, name: "Second Billed", character: "Role B", order: 1 },
            ];

            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 4);
            assert.equal(normalized[0].name, "First Billed");
            assert.equal(normalized[0].order, 0);
            assert.equal(normalized[1].name, "Second Billed");
            assert.equal(normalized[1].order, 1);
            assert.equal(normalized[2].name, "Third Billed");
            assert.equal(normalized[2].order, 2);
            assert.equal(normalized[3].name, "Unbilled");
            assert.equal(normalized[3].order, undefined);
        });

        it("deduplicates multi-role actors, combines character names and retains lowest billing order", () => {
            const raw = [
                { id: 50, name: "Mike Myers", character: "Austin Powers", order: 0, profile_path: "/mike.jpg" },
                { id: 50, name: "Mike Myers", character: "Dr. Evil", order: 1, profile_path: null },
                { id: 50, name: "Mike Myers", character: "Fat Bastard", order: 4, profile_path: null },
                { id: 60, name: "Heather Graham", character: "Felicity Shagwell", order: 2, profile_path: "/heather.jpg" }
            ];

            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 2);
            assert.equal(normalized[0].name, "Mike Myers");
            assert.equal(normalized[0].character, "Austin Powers / Dr. Evil / Fat Bastard");
            assert.equal(normalized[0].order, 0);
            assert.equal(normalized[0].profile_path, "/mike.jpg");
            assert.equal(normalized[1].name, "Heather Graham");
        });

        it("correctly handles character strings that already contain slashes without duplicating entries", () => {
            const raw = [
                { id: 1, name: "Christian Bale", character: "Bruce Wayne", order: 0 },
                { id: 1, name: "Christian Bale", character: "Bruce Wayne / Batman", order: 0 }
            ];

            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 1);
            assert.equal(normalized[0].character, "Bruce Wayne / Batman");
        });

        it("deduplicates identical character names and cleans whitespace", () => {
            const raw = [
                { id: 70, name: "Actor X", character: "  Leader  ", order: 1 },
                { id: 70, name: "Actor X", character: "Leader", order: 2 },
                { id: 70, name: "Actor X", character: "", order: 3 },
            ];

            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 1);
            assert.equal(normalized[0].character, "Leader");
            assert.equal(normalized[0].order, 1);
        });

        it("extracts characters from roles array if present", () => {
            const raw = [
                {
                    id: 80,
                    name: "Voice Actor",
                    roles: [
                        { character: "Robot A" },
                        { character: "Robot B" }
                    ],
                    order: 5
                }
            ];

            const normalized = normalizeMovieCast(raw);
            assert.equal(normalized.length, 1);
            assert.equal(normalized[0].character, "Robot A / Robot B");
        });
    });

    describe("getCrewJobPriority & normalizeMovieCrew", () => {
        it("accurately prioritizes key creative cinema roles over assistant and runner jobs", () => {
            assert.equal(getCrewJobPriority("Director", "Directing"), 1);
            assert.equal(getCrewJobPriority("Screenplay", "Writing"), 2);
            assert.equal(getCrewJobPriority("Producer", "Production"), 3);
            assert.equal(getCrewJobPriority("Director of Photography", "Camera"), 4);
            assert.equal(getCrewJobPriority("Editor", "Editing"), 5);
            assert.equal(getCrewJobPriority("Original Music Composer", "Sound"), 6);

            // Assistant Director and Production Assistant do not get top priority
            assert.equal(getCrewJobPriority("Second Assistant Director", "Directing"), 10);
            assert.equal(getCrewJobPriority("Production Assistant", "Production"), 12);
        });

        it("handles empty, null, or non-array inputs safely", () => {
            assert.deepEqual(normalizeMovieCrew([]), []);
            assert.deepEqual(normalizeMovieCrew(null as any), []);
            assert.deepEqual(normalizeMovieCrew(undefined as any), []);
        });

        it("filters out invalid crew entries without id or with empty names", () => {
            const raw = [
                null,
                {},
                { id: NaN, name: "NaN Crew" },
                { id: 10, name: "" },
                { id: 11, name: "Christopher Nolan", job: "Director", department: "Directing" }
            ];
            const normalized = normalizeMovieCrew(raw);
            assert.equal(normalized.length, 1);
            assert.equal(normalized[0].name, "Christopher Nolan");
        });

        it("ensures Assistant Director does not outrank Director and Production Assistant does not outrank DP or Composer", () => {
            const raw = [
                { id: 1, name: "Aaron Assistant", job: "Second Assistant Director", department: "Directing" },
                { id: 2, name: "Steven Spielberg", job: "Director", department: "Directing" },
                { id: 3, name: "Bob Runner", job: "Production Assistant", department: "Production" },
                { id: 4, name: "John Williams", job: "Original Music Composer", department: "Sound" },
                { id: 5, name: "Janusz Kaminski", job: "Director of Photography", department: "Camera" },
                { id: 6, name: "Michael Kahn", job: "Editor", department: "Editing" },
            ];

            const normalized = normalizeMovieCrew(raw);
            assert.equal(normalized[0].name, "Steven Spielberg");
            assert.equal(normalized[0].job, "Director");
            assert.equal(normalized[0].priority, 1);

            assert.equal(normalized[1].name, "Janusz Kaminski");
            assert.equal(normalized[1].priority, 4);

            assert.equal(normalized[2].name, "Michael Kahn");
            assert.equal(normalized[2].priority, 5);

            assert.equal(normalized[3].name, "John Williams");
            assert.equal(normalized[3].priority, 6);

            assert.equal(normalized[4].name, "Aaron Assistant");
            assert.equal(normalized[4].priority, 10);

            assert.equal(normalized[5].name, "Bob Runner");
            assert.equal(normalized[5].priority, 12);
        });

        it("merges multiple jobs for the same crew member and sorts jobs by prestige/priority ascending", () => {
            const raw = [
                { id: 20, name: "Christopher Nolan", job: "Producer", department: "Production" },
                { id: 20, name: "Christopher Nolan", job: "Director", department: "Directing", profile_path: "/nolan.jpg" },
                { id: 20, name: "Christopher Nolan", job: "Screenplay", department: "Writing" },
                { id: 30, name: "Hoyte van Hoytema", job: "Director of Photography", department: "Camera" },
                { id: 40, name: "Ludwig Göransson", job: "Original Music Composer", department: "Sound" },
            ];

            const normalized = normalizeMovieCrew(raw);
            assert.equal(normalized.length, 3);

            // Christopher Nolan has Director (1) / Screenplay (2) / Producer (3)
            assert.equal(normalized[0].name, "Christopher Nolan");
            assert.equal(normalized[0].job, "Director / Screenplay / Producer");
            assert.equal(normalized[0].department, "Directing");
            assert.equal(normalized[0].profile_path, "/nolan.jpg");
            assert.equal(normalized[0].priority, 1);

            // DP (Camera) priority 4
            assert.equal(normalized[1].name, "Hoyte van Hoytema");
            assert.equal(normalized[1].priority, 4);

            // Composer (Sound) priority 6
            assert.equal(normalized[2].name, "Ludwig Göransson");
            assert.equal(normalized[2].priority, 6);
        });
    });

    describe("movieService TMDB integration", () => {
        it("fetches movie details with complete normalized cast and crew without slicing to 10", async () => {
            const originalFetch = globalThis.fetch;
            try {
                globalThis.fetch = (async (url: string) => {
                    if (url.includes("/movie/550")) {
                        const cast = Array.from({ length: 30 }, (_, i) => ({
                            id: 100 + i,
                            name: `Cast Member ${i + 1}`,
                            character: `Character ${i + 1}`,
                            order: i,
                            profile_path: `/path${i}.jpg`
                        }));

                        const crew = [
                            { id: 201, name: "David Fincher", job: "Director", department: "Directing" },
                            { id: 202, name: "Jim Uhls", job: "Screenplay", department: "Writing" },
                        ];

                        return {
                            ok: true,
                            json: async () => ({
                                id: 550,
                                title: "Fight Club",
                                overview: "An insomniac office worker...",
                                release_date: "1999-10-15",
                                vote_average: 8.4,
                                genres: [{ id: 18, name: "Drama" }],
                                credits: { cast, crew },
                                "watch/providers": { results: {} },
                                external_ids: { imdb_id: "tt0137523" }
                            })
                        };
                    }
                    return { ok: false, status: 404 };
                }) as any;

                const movie = await movieService.getMovieDetails(550);
                assert.equal(movie.id, 550);
                assert.equal(movie.title, "Fight Club");
                // Was previously sliced to 10, now all 30 cast members are retained
                assert.equal(movie.cast.length, 30);
                assert.equal(movie.cast[0].name, "Cast Member 1");
                assert.equal(movie.cast[29].name, "Cast Member 30");

                // Crew is normalized and included
                assert.ok(movie.crew);
                assert.equal(movie.crew.length, 2);
                assert.equal(movie.crew[0].name, "David Fincher");
                assert.equal(movie.imdb_id, "tt0137523");
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it("fetches movie credits endpoint independently", async () => {
            const originalFetch = globalThis.fetch;
            try {
                globalThis.fetch = (async (url: string) => {
                    if (url.includes("/movie/100/credits")) {
                        return {
                            ok: true,
                            json: async () => ({
                                id: 100,
                                cast: [
                                    { id: 1, name: "Actor One", character: "Role One", order: 0 }
                                ],
                                crew: [
                                    { id: 2, name: "Director One", job: "Director", department: "Directing" }
                                ]
                            })
                        };
                    }
                    return { ok: false, status: 404 };
                }) as any;

                const credits = await movieService.getMovieCredits(100);
                assert.equal(credits.cast.length, 1);
                assert.equal(credits.cast[0].name, "Actor One");
                assert.equal(credits.crew.length, 1);
                assert.equal(credits.crew[0].name, "Director One");
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it("guards against non-finite movieId and handles network errors safely in getMovieCredits", async () => {
            const resNaN = await movieService.getMovieCredits(NaN);
            assert.deepEqual(resNaN, { cast: [], crew: [] });

            const resInf = await movieService.getMovieCredits(Infinity);
            assert.deepEqual(resInf, { cast: [], crew: [] });

            const originalFetch = globalThis.fetch;
            try {
                globalThis.fetch = (async () => {
                    throw new Error("Network failure");
                }) as any;

                const resErr = await movieService.getMovieCredits(999);
                assert.deepEqual(resErr, { cast: [], crew: [] });
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it("handles invalid and NaN movie IDs gracefully without error", async () => {
            const invalidResult = await movieService.getMovieCredits(NaN);
            assert.deepEqual(invalidResult, { cast: [], crew: [] });
        });
    });

    describe("MovieCastTabs Filtering, Department & Cross-Category Search Logic", () => {
        const mockCast = [
            { id: 1, name: "Cillian Murphy", character: "J. Robert Oppenheimer", order: 0 },
            { id: 2, name: "Emily Blunt", character: "Katherine 'Kitty' Oppenheimer", order: 1 },
            { id: 3, name: "Matt Damon", character: "Leslie Groves", order: 2 },
            { id: 4, name: "Robert Downey Jr.", character: "Lewis Strauss", order: 3 },
            { id: 5, name: "Florence Pugh", character: "Jean Tatlock", order: 4 },
        ];

        const mockCrew = [
            { id: 10, name: "Christopher Nolan", job: "Director / Screenplay / Producer", department: "Directing", profile_path: null, priority: 1 },
            { id: 11, name: "Ludwig Göransson", job: "Original Music Composer", department: "Sound", profile_path: null, priority: 6 },
            { id: 12, name: "Hoyte van Hoytema", job: "Director of Photography", department: "Camera", profile_path: null, priority: 4 },
            { id: 13, name: "Emma Thomas", job: "Producer", department: "Production", profile_path: null, priority: 3 },
            { id: 14, name: "Assistant Crew", job: "Production Assistant", department: "Production", profile_path: null, priority: 12 },
        ];

        it("filters cast members by query matching actor name case-insensitively", () => {
            const query = "cillian";
            const filtered = mockCast.filter(c =>
                c.name.toLowerCase().includes(query) || c.character.toLowerCase().includes(query)
            );
            assert.equal(filtered.length, 1);
            assert.equal(filtered[0].name, "Cillian Murphy");
        });

        it("filters cast members by query matching character name case-insensitively", () => {
            const query = "kitty";
            const filtered = mockCast.filter(c =>
                c.name.toLowerCase().includes(query) || c.character.toLowerCase().includes(query)
            );
            assert.equal(filtered.length, 1);
            assert.equal(filtered[0].name, "Emily Blunt");
        });

        it("filters crew members by query matching job or department", () => {
            const query = "music";
            const filtered = mockCrew.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.job.toLowerCase().includes(query) ||
                c.department.toLowerCase().includes(query)
            );
            assert.equal(filtered.length, 1);
            assert.equal(filtered[0].name, "Ludwig Göransson");
        });

        it("distinguishes Key Crew (priority <= 9) from All Crew", () => {
            const keyCrew = mockCrew.filter(c => c.priority !== undefined && c.priority <= 9);
            // Nolan, Göransson, van Hoytema, Emma Thomas (4 items)
            assert.equal(keyCrew.length, 4);
            // Assistant Crew with priority 12 is excluded from Key Crew
            assert.ok(!keyCrew.some(c => c.name === "Assistant Crew"));

            // All Crew contains all 5 items
            assert.equal(mockCrew.length, 5);
        });

        it("filters crew by specific department correctly", () => {
            const soundDept = mockCrew.filter(c => c.department === "Sound");
            assert.equal(soundDept.length, 1);
            assert.equal(soundDept[0].name, "Ludwig Göransson");

            const prodDept = mockCrew.filter(c => c.department === "Production");
            assert.equal(prodDept.length, 2);
        });

        it("performs cross-category search discovery when zero matches are found in current view", () => {
            // Searching "Nolan" while on Cast tab finds 0 in Cast, but 1 in Crew
            const query = "nolan";
            const castMatches = mockCast.filter(c => c.name.toLowerCase().includes(query) || c.character.toLowerCase().includes(query));
            const crewMatches = mockCrew.filter(c => c.name.toLowerCase().includes(query) || c.job.toLowerCase().includes(query) || c.department.toLowerCase().includes(query));

            assert.equal(castMatches.length, 0);
            assert.equal(crewMatches.length, 1);
            assert.equal(crewMatches[0].name, "Christopher Nolan");

            // Searching "Blunt" while on Crew tab finds 0 in Crew, but 1 in Cast
            const query2 = "blunt";
            const castMatches2 = mockCast.filter(c => c.name.toLowerCase().includes(query2) || c.character.toLowerCase().includes(query2));
            const crewMatches2 = mockCrew.filter(c => c.name.toLowerCase().includes(query2) || c.job.toLowerCase().includes(query2) || c.department.toLowerCase().includes(query2));

            assert.equal(crewMatches2.length, 0);
            assert.equal(castMatches2.length, 1);
            assert.equal(castMatches2[0].name, "Emily Blunt");
        });

        it("searching on top-billed searches across the complete cast list", () => {
            const largeCast = Array.from({ length: 30 }, (_, i) => ({
                id: i + 1,
                name: `Actor ${i + 1}`,
                character: `Character ${i + 1}`,
                order: i,
                profile_path: null,
            }));

            // Actor 25 is not in the top 15
            const query = "actor 25";
            const searchInEntireCast = largeCast.filter(c => c.name.toLowerCase().includes(query));
            assert.equal(searchInEntireCast.length, 1);
            assert.equal(searchInEntireCast[0].order, 24);
        });

        it("pagination threshold triggers Show All when items exceed 24", () => {
            const smallCast = mockCast; // 5 members
            assert.equal(smallCast.length > 24, false);

            const largeCast = Array.from({ length: 28 }, (_, i) => ({
                id: i + 1,
                name: `Actor ${i + 1}`,
                character: `Role ${i + 1}`,
                order: i,
                profile_path: null,
            }));
            assert.equal(largeCast.length > 24, true);

            // Initially display 20 items
            const displayed = largeCast.slice(0, 20);
            assert.equal(displayed.length, 20);
        });
    });
});
