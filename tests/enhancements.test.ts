import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TMDBError } from "../src/lib/tmdb.ts";
import { getExternalRatings, resetOmdbCooldown, isOmdbInCooldown } from "../src/lib/omdb.ts";
import { sanitizePlayerProgress } from "../src/lib/player.ts";
import { validateRequestOrigin } from "../src/lib/security.ts";
import { formatHistoryDate } from "../src/lib/date.ts";
import { matchesGenreFilter, getGenreIdForDiscover } from "../src/lib/genres.ts";
import { cleanLLMOutput, makeAICacheKey, getAIRateLimitInfo, isQuotaError, markAIRateLimited } from "../src/lib/ai.ts";

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

    it("activates circuit breaker when request limit is reached", async () => {
        resetOmdbCooldown();
        const originalApiKey = process.env.OMDB_API_KEY;
        process.env.OMDB_API_KEY = "dummy_key";

        let fetchCount = 0;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
            fetchCount++;
            return new Response(JSON.stringify({ Response: "False", Error: "Request limit reached!" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        };

        try {
            assert.equal(isOmdbInCooldown(), false);
            const first = await getExternalRatings("The Dark Knight");
            assert.equal(first, null);
            assert.equal(fetchCount, 1);
            assert.equal(isOmdbInCooldown(), true);

            // Second call should NOT invoke fetch
            const second = await getExternalRatings("Interstellar");
            assert.equal(second, null);
            assert.equal(fetchCount, 1, "Fetch should not be called while circuit breaker is active");
        } finally {
            resetOmdbCooldown();
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

describe("Cross-media genre mapping and filtering", () => {
    it("maps Movie action (28) to TV Action & Adventure (10759)", () => {
        // TV series with 10759 should match when filter is 28 (Action)
        assert.equal(matchesGenreFilter([10759, 18], 28, "tv"), true);
        assert.equal(matchesGenreFilter([10759, 18], "28", "tv"), true);

        // TV series with 10759 should match when filter is 12 (Adventure)
        assert.equal(matchesGenreFilter([10759], 12, "tv"), true);

        // Movie with 28 should match when filter is 28
        assert.equal(matchesGenreFilter([28, 53], 28, "movie"), true);

        // TV series with unrelated genre should not match
        assert.equal(matchesGenreFilter([35, 18], 28, "tv"), false);
    });

    it("maps Sci-Fi & Fantasy between movie and TV", () => {
        // TV series with 10765 should match Movie Sci-Fi (878) and Fantasy (14)
        assert.equal(matchesGenreFilter([10765], 878, "tv"), true);
        assert.equal(matchesGenreFilter([10765], 14, "tv"), true);

        // Movie with 878 should match TV Sci-Fi & Fantasy (10765)
        assert.equal(matchesGenreFilter([878], 10765, "movie"), true);
    });

    it("translates genre IDs for TMDB discover queries", () => {
        assert.equal(getGenreIdForDiscover("28", "tv"), "10759");
        assert.equal(getGenreIdForDiscover("12", "tv"), "10759");
        assert.equal(getGenreIdForDiscover("878", "tv"), "10765");
        assert.equal(getGenreIdForDiscover("10752", "tv"), "10768");
        // Movie remains untouched
        assert.equal(getGenreIdForDiscover("28", "movie"), "28");
    });
});

describe("cleanLLMOutput parser robustness", () => {
    it("handles strings with nested curly braces without premature termination", () => {
        const input = `Sure! Here is the JSON:
\`\`\`json
{
  "verdict": "Great movie {with memorable twists}!",
  "score": 95
}
\`\`\``;
        const cleaned = cleanLLMOutput(input);
        const parsed = JSON.parse(cleaned);
        assert.equal(parsed.verdict, "Great movie {with memorable twists}!");
        assert.equal(parsed.score, 95);
    });

    it("handles escaped quotes inside string values", () => {
        const input = `{\n  "verdict": "He said \\"run\\" and escaped.",\n  "score": 88\n}`;
        const cleaned = cleanLLMOutput(input);
        const parsed = JSON.parse(cleaned);
        assert.equal(parsed.verdict, 'He said "run" and escaped.');
        assert.equal(parsed.score, 88);
    });

    it("extracts balanced JSON arrays correctly", () => {
        const input = `Here is the list: [{"title": "Film A"}, {"title": "Film B"}] hope this helps!`;
        const cleaned = cleanLLMOutput(input);
        const parsed = JSON.parse(cleaned);
        assert.equal(parsed.length, 2);
        assert.equal(parsed[0].title, "Film A");
    });

    it("prefers actual data block over schema definition blocks", () => {
        const input = `{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object"}
Now the result:
{"verdict": "Must watch", "score": 99}`;
        const cleaned = cleanLLMOutput(input);
        const parsed = JSON.parse(cleaned);
        assert.equal(parsed.verdict, "Must watch");
    });

    it("repairs missing commas before new keys", () => {
        const input = `{\n  "title": "Inception"\n  "score": 90\n}`;
        const cleaned = cleanLLMOutput(input);
        const parsed = JSON.parse(cleaned);
        assert.equal(parsed.title, "Inception");
        assert.equal(parsed.score, 90);
    });
});

describe("makeAICacheKey collision resistance", () => {
    it("generates distinct cache keys for different Unicode / non-ASCII queries", () => {
        const bengali1 = makeAICacheKey("mood", "রোমান্টিক কমেডি");
        const bengali2 = makeAICacheKey("mood", "ভৌতিক সিনেমা");
        const japanese = makeAICacheKey("mood", "日本のホラー映画");
        const spanish = makeAICacheKey("mood", "película de acción");

        assert.notEqual(bengali1, bengali2);
        assert.notEqual(bengali1, japanese);
        assert.notEqual(japanese, spanish);

        // Keys must not contain raw unicode or special characters
        assert.match(bengali1, /^mood_[a-f0-9]{32}$/);
    });

    it("normalizes case and surrounding whitespace to ensure cache hits", () => {
        const key1 = makeAICacheKey("mood", "  Inception ");
        const key2 = makeAICacheKey("mood", "inception");
        assert.equal(key1, key2);
    });
});

describe("AI Rate Limit & Quota reset tracking", () => {
    it("returns valid rate limit info with future resetAt and positive retryAfterSeconds", () => {
        const info = getAIRateLimitInfo();
        assert.ok(info.limit > 0);
        assert.ok(info.resetAt > Date.now() - 1000);
        assert.ok(info.retryAfterSeconds >= 0);
    });

    it("detects quota and rate limit errors via isQuotaError", () => {
        assert.equal(isQuotaError({ status: 429 }), true);
        assert.equal(isQuotaError({ statusCode: 429 }), true);
        assert.equal(isQuotaError(new Error("Resource exhausted: 429 Quota exceeded")), true);
        assert.equal(isQuotaError(new Error("Rate limit exceeded for model")), true);
        assert.equal(isQuotaError(new Error("Standard network timeout")), false);
        assert.equal(isQuotaError(null), false);
    });

    it("markAIRateLimited updates resetAt and retry window", () => {
        markAIRateLimited(45);
        const info = getAIRateLimitInfo();
        assert.ok(info.retryAfterSeconds >= 40 && info.retryAfterSeconds <= 46);
        assert.ok(info.resetAt > Date.now());
    });
});
