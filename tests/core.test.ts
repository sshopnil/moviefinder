import { describe, it } from "node:test";
import assert from "node:assert/strict";
import tmdbLoader from "../src/lib/image-loader.ts";
import { checkRateLimit } from "../src/lib/rate-limit.ts";

describe("tmdbLoader", () => {
    it("rewrites TMDB poster URLs to the appropriate size with width parameter", () => {
        const src = "https://image.tmdb.org/t/p/w500/abc123.jpg";
        assert.equal(
            tmdbLoader({ src, width: 300 }),
            "https://image.tmdb.org/t/p/w342/abc123.jpg?w=300"
        );
        assert.equal(
            tmdbLoader({ src, width: 640 }),
            "https://image.tmdb.org/t/p/w780/abc123.jpg?w=640"
        );
    });

    it("caps TMDB backdrop URLs at w1280 instead of 4K original", () => {
        const src = "https://image.tmdb.org/t/p/w1280/backdrop.jpg";
        assert.equal(
            tmdbLoader({ src, width: 1920 }),
            "https://image.tmdb.org/t/p/w1280/backdrop.jpg?w=1920"
        );
        assert.equal(
            tmdbLoader({ src, width: 640 }),
            "https://image.tmdb.org/t/p/w780/backdrop.jpg?w=640"
        );
    });

    it("maps TMDB profile URLs to valid profile sizes", () => {
        const src = "https://image.tmdb.org/t/p/h632/actor.jpg";
        assert.equal(
            tmdbLoader({ src, width: 100 }),
            "https://image.tmdb.org/t/p/w185/actor.jpg?w=100"
        );
        assert.equal(
            tmdbLoader({ src, width: 300 }),
            "https://image.tmdb.org/t/p/h632/actor.jpg?w=300"
        );
    });

    it("passes through local and non-TMDB URLs unchanged", () => {
        assert.equal(
            tmdbLoader({ src: "/placeholder-poster.png", width: 300 }),
            "/placeholder-poster.png"
        );
    });
});

describe("checkRateLimit", () => {
    it("allows requests within the limit and blocks once exceeded", () => {
        const key = `test-key-${Date.now()}`;
        const first = checkRateLimit(key, 2, 10_000);
        const second = checkRateLimit(key, 2, 10_000);
        const third = checkRateLimit(key, 2, 10_000);

        assert.equal(first.allowed, true);
        assert.equal(first.remaining, 1);
        assert.equal(second.allowed, true);
        assert.equal(second.remaining, 0);
        assert.equal(third.allowed, false);
        assert.equal(third.remaining, 0);
    });
});

