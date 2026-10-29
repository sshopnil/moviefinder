import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tvService } from "../src/lib/tmdb.ts";

describe("TV Series Season Cast & Tabs", () => {
    it("handles invalid or non-numeric tvId or seasonNumber safely", async () => {
        const result1 = await tvService.getTVSeasonCredits(NaN, 1);
        assert.deepEqual(result1, []);

        const result2 = await tvService.getTVSeasonCredits(1399, NaN);
        assert.deepEqual(result2, []);
    });

    it("verifies tvService.getTVSeasonCredits handles network errors gracefully without throwing", async () => {
        const originalFetch = globalThis.fetch;
        try {
            // Mock fetch to simulate network error
            globalThis.fetch = (async () => {
                throw new Error("Network timeout");
            }) as any;

            const credits = await tvService.getTVSeasonCredits(999999, 1);
            assert.deepEqual(credits, []);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("orders TV seasons correctly placing regular seasons first and specials at the end", () => {
        const mockSeasons = [
            { id: 100, name: "Specials", season_number: 0, episode_count: 5, overview: "", poster_path: null, air_date: "" },
            { id: 102, name: "Season 2", season_number: 2, episode_count: 10, overview: "", poster_path: null, air_date: "" },
            { id: 101, name: "Season 1", season_number: 1, episode_count: 10, overview: "", poster_path: null, air_date: "" },
            { id: 103, name: "Season 3", season_number: 3, episode_count: 10, overview: "", poster_path: null, air_date: "" },
        ];

        const regularSeasons = mockSeasons
            .filter((s) => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

        const specialsSeason = mockSeasons.find((s) => s.season_number === 0 && (s.episode_count || 0) > 0);

        const ordered = specialsSeason ? [...regularSeasons, specialsSeason] : regularSeasons;

        assert.equal(ordered.length, 4);
        assert.equal(ordered[0].season_number, 1);
        assert.equal(ordered[1].season_number, 2);
        assert.equal(ordered[2].season_number, 3);
        assert.equal(ordered[3].season_number, 0);
    });

    it("returns season credits from mock fetch properly", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/1/credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                { id: 1, name: "Sean Bean", character: "Ned Stark", profile_path: "/sean.jpg" },
                                { id: 2, name: "Mark Addy", character: "Robert Baratheon", profile_path: "/mark.jpg" }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 1);
            assert.equal(credits.length, 2);
            assert.equal(credits[0].name, "Sean Bean");
            assert.equal(credits[0].character, "Ned Stark");
            assert.equal(credits[1].name, "Mark Addy");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("fetches TV series details using aggregate_credits to show all series cast across seasons", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            name: "Game of Thrones",
                            overview: "Seven noble families fight for control...",
                            first_air_date: "2011-04-17",
                            genres: [{ id: 18, name: "Drama" }],
                            seasons: [
                                { id: 1, season_number: 1, name: "Season 1", episode_count: 10 }
                            ],
                            aggregate_credits: {
                                cast: [
                                    {
                                        id: 22970,
                                        name: "Peter Dinklage",
                                        profile_path: "/peter.jpg",
                                        roles: [{ character: "Tyrion Lannister", episode_count: 67 }],
                                        total_episode_count: 67,
                                        order: 0,
                                    },
                                    {
                                        id: 1,
                                        name: "Sean Bean",
                                        profile_path: "/sean.jpg",
                                        roles: [{ character: "Ned Stark", episode_count: 10 }],
                                        total_episode_count: 10,
                                        order: 1,
                                    },
                                    // Duplicate actor with multiple roles should be deduplicated
                                    {
                                        id: 22970,
                                        name: "Peter Dinklage",
                                        profile_path: "/peter.jpg",
                                        roles: [{ character: "Tyrion Lannister", episode_count: 67 }],
                                        total_episode_count: 67,
                                        order: 0,
                                    }
                                ]
                            },
                            credits: {
                                // Standard credits only had Season 8 cast (omitted Ned Stark)
                                cast: [
                                    { id: 22970, name: "Peter Dinklage", character: "Tyrion Lannister", profile_path: "/peter.jpg" }
                                ]
                            }
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const tv = await tvService.getTVDetails(1399);
            assert.equal(tv.cast.length, 2); // Peter Dinklage and Sean Bean (deduplicated)
            assert.equal(tv.cast[0].name, "Peter Dinklage");
            assert.equal(tv.cast[0].character, "Tyrion Lannister");
            assert.equal(tv.cast[0].total_episode_count, 67);

            assert.equal(tv.cast[1].name, "Sean Bean");
            assert.equal(tv.cast[1].character, "Ned Stark");
            assert.equal(tv.cast[1].total_episode_count, 10);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("falls back to standard credits when aggregate_credits is empty or absent", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/123")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 123,
                            name: "Mini Series",
                            aggregate_credits: { cast: [] },
                            credits: {
                                cast: [
                                    { id: 10, name: "Actor A", character: "Role A", profile_path: null }
                                ]
                            }
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const tv = await tvService.getTVDetails(123);
            assert.equal(tv.cast.length, 1);
            assert.equal(tv.cast[0].name, "Actor A");
            assert.equal(tv.cast[0].character, "Role A");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("fetches TV season credits using aggregate_credits with multiple roles and episode counts", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/2/aggregate_credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                {
                                    id: 101,
                                    name: "Lena Headey",
                                    profile_path: "/lena.jpg",
                                    roles: [{ character: "Cersei Lannister", episode_count: 10 }],
                                    total_episode_count: 10,
                                    order: 1,
                                },
                                {
                                    id: 102,
                                    name: "Tom Wlaschiha",
                                    profile_path: "/tom.jpg",
                                    roles: [
                                        { character: "Jaqen H'ghar", episode_count: 6 },
                                        { character: "Faceless Man", episode_count: 2 }
                                    ],
                                    total_episode_count: 8,
                                    order: 5,
                                }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 2);
            assert.equal(credits.length, 2);
            assert.equal(credits[0].name, "Lena Headey");
            assert.equal(credits[0].character, "Cersei Lannister");
            assert.equal(credits[0].total_episode_count, 10);

            // Formats multi-role characters with '/' separator
            assert.equal(credits[1].name, "Tom Wlaschiha");
            assert.equal(credits[1].character, "Jaqen H'ghar / Faceless Man");
            assert.equal(credits[1].total_episode_count, 8);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("verifies tvService.getTVSeasonCredits safely guards against non-finite parameters", async () => {
        // Invalid inputs
        const invalid1 = await tvService.getTVSeasonCredits(NaN, 1);
        assert.deepEqual(invalid1, []);
        const invalid2 = await tvService.getTVSeasonCredits(1399, NaN);
        assert.deepEqual(invalid2, []);
        const invalid3 = await tvService.getTVSeasonCredits(Infinity, 1);
        assert.deepEqual(invalid3, []);
    });

    it("deduplicates identical character names across multiple role contracts", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/1/aggregate_credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                {
                                    id: 1,
                                    name: "Sean Bean",
                                    profile_path: "/sean.jpg",
                                    roles: [
                                        { character: "Eddard 'Ned' Stark", episode_count: 5 },
                                        { character: "Eddard 'Ned' Stark", episode_count: 5 }
                                    ],
                                    total_episode_count: 10,
                                    order: 0,
                                }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 1);
            assert.equal(credits.length, 1);
            // Should be deduplicated to a single character name, NOT "Eddard 'Ned' Stark / Eddard 'Ned' Stark"
            assert.equal(credits[0].character, "Eddard 'Ned' Stark");
            assert.equal(credits[0].total_episode_count, 10);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("merges multiple separate cast entries for the same actor across roles and sums episode counts", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/3/credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                {
                                    id: 200,
                                    name: "Dual Actor",
                                    character: "Role Alpha",
                                    profile_path: null,
                                    total_episode_count: 4,
                                    order: 10,
                                },
                                {
                                    id: 200,
                                    name: "Dual Actor",
                                    character: "Role Beta",
                                    profile_path: "/dual.jpg",
                                    total_episode_count: 2,
                                    order: 5,
                                }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 3);
            assert.equal(credits.length, 1);
            assert.equal(credits[0].name, "Dual Actor");
            assert.equal(credits[0].character, "Role Alpha / Role Beta");
            assert.equal(credits[0].total_episode_count, 6);
            assert.equal(credits[0].profile_path, "/dual.jpg");
            assert.equal(credits[0].order, 5); // lowest order retained
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("gracefully trims whitespace and filters empty character names in roles", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/4/aggregate_credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                {
                                    id: 300,
                                    name: "Actor With Spaces",
                                    roles: [
                                        { character: "   ", episode_count: 1 },
                                        { character: "  King's Guard  ", episode_count: 3 },
                                        { character: "", episode_count: 1 }
                                    ],
                                    order: 20,
                                }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 4);
            assert.equal(credits.length, 1);
            assert.equal(credits[0].character, "King's Guard");
            assert.equal(credits[0].total_episode_count, 5);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("supports Season 0 specials query properly", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/0/credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                { id: 400, name: "Special Guest", character: "Self", profile_path: null }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 0);
            assert.equal(credits.length, 1);
            assert.equal(credits[0].name, "Special Guest");
            assert.equal(credits[0].character, "Self");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("preserves Next.js internal history state (__NA: true) when updating URL search params to avoid scroll reset", () => {
        // Simulate window.location and history
        const mockHistory: { state: Record<string, unknown>; url: string } = {
            state: { __NA: true, customKey: "value" },
            url: "http://localhost:3000/tv/1399"
        };

        const updateUrlSilently = (tab: "all" | number, currentHref: string, historyState: Record<string, unknown> | null) => {
            const currentUrl = new URL(currentHref);
            if (tab === "all") {
                currentUrl.searchParams.delete("season");
            } else {
                currentUrl.searchParams.set("season", tab.toString());
            }
            const nextState: Record<string, unknown> = {
                ...(historyState || {}),
                __NA: true,
            };
            return {
                url: currentUrl.toString(),
                state: nextState,
            };
        };

        // Switching to Season 2
        const res1 = updateUrlSilently(2, mockHistory.url, mockHistory.state);
        assert.equal(res1.url, "http://localhost:3000/tv/1399?season=2");
        assert.equal(res1.state.__NA, true);
        assert.equal(res1.state.customKey, "value");

        // Switching back to "all" cast
        const res2 = updateUrlSilently("all", res1.url, res1.state);
        assert.equal(res2.url, "http://localhost:3000/tv/1399");
        assert.equal(res2.state.__NA, true);
    });

    it("handles TV series with empty seasons array gracefully", () => {
        const seasons: Array<{ season_number: number; episode_count?: number }> = [];
        const regularSeasons = seasons
            .filter((s) => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);
        const specialsSeason = seasons.find((s) => s.season_number === 0 && (s.episode_count || 0) > 0);
        const orderedSeasons = specialsSeason ? [...regularSeasons, specialsSeason] : regularSeasons;

        assert.deepEqual(orderedSeasons, []);
    });

    it("parses popstate search params safely against known seasons", () => {
        const mockSeasons = [
            { id: 1, season_number: 1, episode_count: 10 },
            { id: 2, season_number: 2, episode_count: 8 },
        ];

        const parseSeason = (search: string, seasons: typeof mockSeasons) => {
            const params = new URLSearchParams(search);
            const sParam = params.get("season");
            if (sParam !== null) {
                const sNum = parseInt(sParam, 10);
                if (Number.isFinite(sNum) && seasons.some((s) => s.season_number === sNum)) {
                    return sNum;
                }
            }
            return "all";
        };

        assert.equal(parseSeason("?season=2", mockSeasons), 2);
        assert.equal(parseSeason("?season=99", mockSeasons), "all");
        assert.equal(parseSeason("?season=invalid", mockSeasons), "all");
        assert.equal(parseSeason("", mockSeasons), "all");
    });

    it("verifies normalizeTVCast sorts actors by billing order (lowest order first)", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string) => {
                if (url.includes("/tv/1399/season/5/aggregate_credits")) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 1399,
                            cast: [
                                { id: 3, name: "Third Billed", order: 2, roles: [{ character: "Char C", episode_count: 5 }] },
                                { id: 1, name: "Top Star", order: 0, roles: [{ character: "Char A", episode_count: 10 }] },
                                { id: 2, name: "Second Billed", order: 1, roles: [{ character: "Char B", episode_count: 8 }] },
                                { id: 4, name: "Unbilled Extra", roles: [{ character: "Char D", episode_count: 1 }] }
                            ]
                        })
                    };
                }
                return { ok: false, status: 404 };
            }) as any;

            const credits = await tvService.getTVSeasonCredits(1399, 5);
            assert.equal(credits.length, 4);
            assert.equal(credits[0].name, "Top Star");
            assert.equal(credits[0].order, 0);
            assert.equal(credits[1].name, "Second Billed");
            assert.equal(credits[1].order, 1);
            assert.equal(credits[2].name, "Third Billed");
            assert.equal(credits[2].order, 2);
            assert.equal(credits[3].name, "Unbilled Extra");
            assert.equal(credits[3].order, undefined);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("calculates exact horizontal centering target position without offsetParent dependency", () => {
        const calculateScrollTarget = (
            containerRect: { left: number; width: number },
            itemRect: { left: number; width: number },
            containerScrollLeft: number
        ) => {
            const relativeLeft = itemRect.left - containerRect.left + containerScrollLeft;
            const targetLeft = relativeLeft - (containerRect.width / 2) + (itemRect.width / 2);
            return Math.max(0, targetLeft);
        };

        // Container is 500px wide, scrolled 100px. Active item is 100px wide, 200px from left of container.
        const target = calculateScrollTarget(
            { left: 50, width: 500 },
            { left: 250, width: 100 },
            100
        );
        // relativeLeft = 250 - 50 + 100 = 300
        // targetLeft = 300 - 250 + 50 = 100
        assert.equal(target, 100);

        // When item is at start, target should clamp to 0
        const startTarget = calculateScrollTarget(
            { left: 50, width: 500 },
            { left: 50, width: 80 },
            0
        );
        assert.equal(startTarget, 0);
    });
});

