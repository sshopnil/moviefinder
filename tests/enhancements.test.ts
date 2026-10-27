import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TMDBError } from "../src/lib/tmdb.ts";
import { getExternalRatings } from "../src/lib/omdb.ts";
import { sanitizePlayerProgress } from "../src/lib/player.ts";
import { validateRequestOrigin } from "../src/lib/security.ts";
import { formatHistoryDate } from "../src/lib/date.ts";

describe("TMDBError", () => {
    it("creates an instance with message and status", () => {
        const error = new TMDBError("TMDB API Error: 404 Not Found", 404);
        assert.equal(error.name, "TMDBError");
        assert.equal(error.status, 404);
        assert.equal(error.message, "TMDB API Error: 404 Not Found");
        assert.ok(error instanceof Error);
    });

    it("handles 500 server error status properly", () => {
        const error = new TMDBError("TMDB API Error: 500 Internal Server Error", 500);
        assert.equal(error.status, 500);
    });
});

describe("OMDb getExternalRatings URL building", () => {
    it("does not append year query when year is undefined or string 'undefined'", async () => {
        const originalApiKey = process.env.OMDB_API_KEY;
        process.env.OMDB_API_KEY = "dummy_key";

        const originalFetch = globalThis.fetch;
        const requestedUrls: string[] = [];

        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            requestedUrls.push(url);
            return new Response(JSON.stringify({ Response: "False", Error: "Movie not found!" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        try {
            await getExternalRatings("Inception", undefined);
            assert.ok(!requestedUrls[0].includes("&y="), "Should not contain &y= when year is undefined");

            await getExternalRatings("Inception", "undefined");
            assert.ok(!requestedUrls[1].includes("&y="), "Should not contain &y= when year is string 'undefined'");

            await getExternalRatings("Inception", "   ");
            assert.ok(!requestedUrls[2].includes("&y="), "Should not contain &y= when year is whitespace");

            await getExternalRatings("Inception", "2010");
            assert.ok(requestedUrls[3].includes("&y=2010"), "Should contain &y=2010 when year is valid");
        } finally {
            globalThis.fetch = originalFetch;
            process.env.OMDB_API_KEY = originalApiKey;
        }
    });
});

describe("Player message progress sanitization", () => {
    it("bounds and sanitizes currentTime and duration correctly", () => {
        // Direct format
        assert.deepEqual(sanitizePlayerProgress({ currentTime: 3600, duration: 7200 }), { progressMins: 60, durationMins: 120 });
        // Nested data format
        assert.deepEqual(sanitizePlayerProgress({ data: { currentTime: 3600, duration: 7200 } }), { progressMins: 60, durationMins: 120 });
        // Time alias format
        assert.deepEqual(sanitizePlayerProgress({ time: 1800, duration: 3600 }), { progressMins: 30, durationMins: 60 });
        // Current time greater than duration is capped
        assert.deepEqual(sanitizePlayerProgress({ currentTime: 8000, duration: 7200 }), { progressMins: 120, durationMins: 120 });
        // Negative current time rejected
        assert.equal(sanitizePlayerProgress({ currentTime: -10, duration: 7200 }), null);
        // Invalid duration rejected
        assert.equal(sanitizePlayerProgress({ currentTime: 100, duration: 0 }), null);
        assert.equal(sanitizePlayerProgress({ currentTime: 100, duration: -100 }), null);
        // Non-number rejected
        assert.equal(sanitizePlayerProgress({ currentTime: "100", duration: 7200 }), null);
        assert.equal(sanitizePlayerProgress({ currentTime: Infinity, duration: 7200 }), null);
        assert.equal(sanitizePlayerProgress({ currentTime: NaN, duration: 7200 }), null);
        // Non-objects and falsy values rejected
        assert.equal(sanitizePlayerProgress(null), null);
        assert.equal(sanitizePlayerProgress(undefined), null);
        assert.equal(sanitizePlayerProgress("some string"), null);
    });
});

describe("API Origin and Referer validation", () => {
    it("accepts same-origin requests matching host", () => {
        assert.equal(validateRequestOrigin("localhost:3000", "http://localhost:3000", "http://localhost:3000/"), true);
        assert.equal(validateRequestOrigin("moviefinder.com", "https://moviefinder.com", "https://moviefinder.com/movie/1"), true);
    });

    it("rejects cross-origin requests", () => {
        assert.equal(validateRequestOrigin("moviefinder.com", "https://evil.com", null), false);
        assert.equal(validateRequestOrigin("moviefinder.com", null, "https://attacker.com/page"), false);
    });

    it("handles multiple x-forwarded-host proxies and standard ports", () => {
        assert.equal(validateRequestOrigin("moviefinder.com, proxy.cdn.net", "https://moviefinder.com", null), true);
        assert.equal(validateRequestOrigin("moviefinder.com:443", "https://moviefinder.com", null), true);
        assert.equal(validateRequestOrigin("moviefinder.com", "https://moviefinder.com:443", null), true);
    });

    it("handles case insensitivity and missing headers safely", () => {
        assert.equal(validateRequestOrigin("MovieFinder.com", "https://moviefinder.com", null), true);
        assert.equal(validateRequestOrigin("moviefinder.com", null, null), true);
        assert.equal(validateRequestOrigin(null, "https://moviefinder.com", null), true);
    });

    it("rejects malformed origin/referer URLs", () => {
        assert.equal(validateRequestOrigin("moviefinder.com", "not-a-valid-url", null), false);
        assert.equal(validateRequestOrigin("moviefinder.com", null, "not-a-valid-url"), false);
    });
});

describe("Date formatting deterministic hydration", () => {
    it("formats ISO timestamps to UTC en-US date string", () => {
        const formatted = formatHistoryDate("2026-05-15T12:00:00.000Z");
        assert.equal(formatted, "May 15, 2026");
    });

    it("handles invalid date strings gracefully without throwing", () => {
        assert.equal(formatHistoryDate("invalid-date"), "");
        assert.equal(formatHistoryDate(""), "");
    });
});
