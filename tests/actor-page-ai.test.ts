import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeScore } from "../src/lib/utils.ts";

describe("Actor Page AI Mode Search Integration", () => {
    it("creates correct mediaType:id lookup keys for AI evaluation", () => {
        const mockAIMatches = [
            { id: 603, media_type: "movie", match_score: 95, reason: "Neo in The Matrix", character: "Neo" },
            { id: 205, media_type: "tv", match_score: 88, reason: "Cyberpunk anime series", character: "David" }
        ];

        const map = new Map();
        for (const m of mockAIMatches) {
            const key = `${m.media_type}:${m.id}`;
            map.set(key, m);
        }

        assert.equal(map.get("movie:603")?.match_score, 95);
        assert.equal(map.get("tv:205")?.match_score, 88);
        assert.equal(map.get("movie:999"), undefined);
    });

    it("filters and sorts actor filmography by AI match score correctly with popularity tie-break", () => {
        const credits = [
            { id: 101, title: "Title A", media_type: "movie", popularity: 50 },
            { id: 603, title: "The Matrix", media_type: "movie", popularity: 90 },
            { id: 205, name: "Cyberpunk", media_type: "tv", popularity: 70 },
            { id: 300, title: "Equal Score Lower Pop", media_type: "movie", popularity: 40 },
            { id: 301, title: "Equal Score Higher Pop", media_type: "movie", popularity: 85 },
            { id: 999, title: "Irrelevant Show", media_type: "movie", popularity: 10 }
        ];

        const aiScores: Record<string, number> = {
            "movie:603": 95,
            "tv:205": 88,
            "movie:300": 80,
            "movie:301": 80,
        };

        // Filter to AI matches
        const filtered = credits.filter(c => {
            const mediaType = c.media_type || (c.title ? "movie" : "tv");
            return Boolean(aiScores[`${mediaType}:${c.id}`]);
        });

        assert.equal(filtered.length, 4);

        // Sort by AI match score descending, tie-breaking on popularity
        filtered.sort((a, b) => {
            const mediaTypeA = a.media_type || (a.title ? "movie" : "tv");
            const mediaTypeB = b.media_type || (b.title ? "movie" : "tv");
            const scoreA = aiScores[`${mediaTypeA}:${a.id}`] || 0;
            const scoreB = aiScores[`${mediaTypeB}:${b.id}`] || 0;
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            return (b.popularity || 0) - (a.popularity || 0);
        });

        assert.equal(filtered[0].id, 603); // 95%
        assert.equal(filtered[1].id, 205); // 88%
        assert.equal(filtered[2].id, 301); // 80%, pop 85
        assert.equal(filtered[3].id, 300); // 80%, pop 40
    });

    it("composes format filter (All / Movies / Series) with AI matches", () => {
        const aiMatches = [
            { id: 1, title: "Movie 1", media_type: "movie" as const },
            { id: 2, title: "Movie 2", media_type: "movie" as const },
            { id: 3, name: "Series 1", media_type: "tv" as const },
        ];

        const movieOnly = aiMatches.filter(m => m.media_type === "movie");
        const seriesOnly = aiMatches.filter(m => m.media_type === "tv");

        assert.equal(movieOnly.length, 2);
        assert.equal(seriesOnly.length, 1);
        assert.equal(seriesOnly[0].id, 3);
    });

    it("extracts match_score and reason from aiMeta using canonical normalizeScore", () => {
        const rawAIMatches = [
            {
                id: 603,
                title: "The Matrix",
                media_type: "movie",
                aiMeta: {
                    relevance_score: 95,
                    reason: "Neo in The Matrix",
                }
            },
            {
                id: 205,
                name: "Cyberpunk: Edgerunners",
                type: "tv",
                aiMeta: {
                    relevance_score: 0.88,
                    reason: "Cyberpunk anime series",
                }
            }
        ];

        const map = new Map<string, any>();
        for (const match of rawAIMatches) {
            const rawScore = (match as any).match_score ?? (match as any).relevance_score ?? match.aiMeta?.relevance_score;
            const score = normalizeScore(rawScore);
            const reason = (match as any).reason || match.aiMeta?.reason || "";
            const mediaType = match.media_type || match.type || "movie";
            const key = `${mediaType}:${match.id}`;
            map.set(key, { match_score: score, reason });
            if (!map.has(`any:${match.id}`)) {
                map.set(`any:${match.id}`, { match_score: score, reason });
            }
        }

        assert.equal(map.get("movie:603")?.match_score, 95);
        assert.equal(map.get("movie:603")?.reason, "Neo in The Matrix");
        assert.equal(map.get("tv:205")?.match_score, 88);
        assert.equal(map.get("tv:205")?.reason, "Cyberpunk anime series");
        // Fallback key
        assert.equal(map.get("any:603")?.match_score, 95);
        assert.equal(map.get("any:205")?.match_score, 88);
    });

    it("correctly normalizes scores using real normalizeScore implementation", () => {
        const testCases = [
            // 0-1 scale decimal fractions -> percentage (0-100)
            { input: 0.94, expected: 94 },
            { input: 0.82, expected: 82 },
            { input: 0.08, expected: 8 },
            { input: 0.77, expected: 77 },
            // 1-10 non-integer ratings -> percentage
            { input: 8.5, expected: 85 },
            { input: 9.2, expected: 92 },
            // 0-100 scale integers -> preserved as exact percentage
            { input: 95, expected: 95 },
            { input: 60, expected: 60 },
            { input: 10, expected: 10 },
            { input: 8, expected: 8 },
            { input: 1, expected: 1 },
            { input: 100, expected: 100 },
            { input: 105, expected: 100 },
            // Invalid / non-positive
            { input: 0, expected: 0 },
            { input: -5, expected: 0 },
            { input: NaN, expected: 0 },
            { input: Infinity, expected: 0 },
            { input: undefined as any, expected: 0 },
        ];

        for (const tc of testCases) {
            const actual = normalizeScore(tc.input);
            assert.equal(actual, tc.expected, `Failed for input ${tc.input}: expected ${tc.expected}, got ${actual}`);
            // Verify idempotence: normalizeScore(normalizeScore(x)) === normalizeScore(x)
            assert.equal(normalizeScore(actual), actual, `Idempotence failed for input ${tc.input}`);
        }
    });

    it("preserves distinct movie and tv entries with identical IDs", () => {
        const evaluatedMatches = [
            { id: 100, type: "movie", match_score: 90, reason: "Movie 100" },
            { id: 100, type: "tv", match_score: 75, reason: "TV 100" },
        ];

        const map = new Map<string, any>();
        for (const match of evaluatedMatches) {
            const key = `${match.type}:${match.id}`;
            map.set(key, match);
            if (!map.has(`any:${match.id}`)) {
                map.set(`any:${match.id}`, match);
            }
        }

        assert.equal(map.get("movie:100")?.match_score, 90);
        assert.equal(map.get("tv:100")?.match_score, 75);
    });

    it("verifies prevInitialMoodRef logic prevents in-page client search wipeout and syncs on external route change", () => {
        // Simulation of MovieBrowser state tracking logic
        let initialMoodProp: string | undefined = undefined;
        let prevInitialMoodRef: { current: string | undefined } = { current: initialMoodProp };

        let isAIMode = Boolean(initialMoodProp);
        let activeAIMood = initialMoodProp || "";
        let aiMatches: any[] = [];

        // Helper simulating the useEffect logic in MovieBrowser
        const runSyncEffect = () => {
            if (initialMoodProp !== prevInitialMoodRef.current) {
                prevInitialMoodRef.current = initialMoodProp;
                if (initialMoodProp) {
                    isAIMode = true;
                    activeAIMood = initialMoodProp;
                    aiMatches = [{ id: 99, match_score: 90 }];
                } else {
                    isAIMode = false;
                    activeAIMood = "";
                    aiMatches = [];
                }
            }
        };

        // 1. Initial mount on /person/118545 (no query param)
        runSyncEffect();
        assert.equal(isAIMode, false);
        assert.equal(activeAIMood, "");
        assert.equal(aiMatches.length, 0);

        // 2. User submits in-page search: "spicy movie of her"
        const clientQuery = "spicy movie of her";
        const clientMatches = [{ id: 216015, match_score: 96, title: "Fifty Shades of Grey" }];
        isAIMode = true;
        activeAIMood = clientQuery;
        aiMatches = clientMatches;
        prevInitialMoodRef.current = clientQuery; // tracked synchronously in handleAISubmit

        // 3. Next.js router.replace delivers matching initialMood prop
        initialMoodProp = "spicy movie of her";
        runSyncEffect();

        // Must NOT overwrite clientMatches with stale server matches
        assert.equal(isAIMode, true);
        assert.equal(activeAIMood, "spicy movie of her");
        assert.equal(aiMatches.length, 1);
        assert.equal(aiMatches[0].id, 216015);
        assert.equal(aiMatches[0].match_score, 96);

        // 4. User navigates back via browser Back button (URL loses mood param)
        initialMoodProp = undefined;
        runSyncEffect();

        // Must cleanly reset state back to default browse mode
        assert.equal(isAIMode, false);
        assert.equal(activeAIMood, "");
        assert.equal(aiMatches.length, 0);
        assert.equal(prevInitialMoodRef.current, undefined);

        // 5. User navigates to a new mood URL directly (e.g. clicking mood chip /person/118545?mood=comedy)
        initialMoodProp = "comedy";
        runSyncEffect();
        assert.equal(isAIMode, true);
        assert.equal(activeAIMood, "comedy");
        assert.equal(prevInitialMoodRef.current, "comedy");
    });

    it("resolves personPayload cleanly whether actorPerson is supplied or falls back to basic details", () => {
        const actorId = 118545;
        const actorName = "Dakota Johnson";

        // Case A: actorPerson provided from PersonPage
        const fullPerson = {
            id: 118545,
            name: "Dakota Johnson",
            profile_path: "/dakota.jpg",
            known_for_department: "Acting",
            biography: "Actress and producer.",
        };
        const payloadA = fullPerson || { id: actorId, name: actorName };
        assert.equal(payloadA.id, 118545);
        assert.equal(payloadA.profile_path, "/dakota.jpg");
        assert.equal(payloadA.biography, "Actress and producer.");

        // Case B: actorPerson omitted (e.g. fallback call sites)
        const noPerson = undefined;
        const payloadB = noPerson || { id: actorId, name: actorName };
        assert.equal(payloadB.id, 118545);
        assert.equal(payloadB.name, "Dakota Johnson");
        assert.equal((payloadB as any).profile_path, undefined);
    });
});

