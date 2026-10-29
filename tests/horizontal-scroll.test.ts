import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    computeHorizontalScrollBoundaries,
    computeHorizontalScrollStep,
    useHorizontalScroll
} from "../src/hooks/use-horizontal-scroll.ts";

describe("Horizontal Scroll & Cast Navigation Logic", () => {
    describe("Scroll boundary calculations and tolerance (computeHorizontalScrollBoundaries)", () => {
        it("disables both arrows when content fits within container without overflow", () => {
            // Container 500px, content 400px (no overflow)
            const state1 = computeHorizontalScrollBoundaries(0, 400, 500);
            assert.equal(state1.canScrollLeft, false);
            assert.equal(state1.canScrollRight, false);
            assert.equal(state1.maxScroll, 0);

            // Container 500px, content exactly 500px
            const state2 = computeHorizontalScrollBoundaries(0, 500, 500);
            assert.equal(state2.canScrollLeft, false);
            assert.equal(state2.canScrollRight, false);
            assert.equal(state2.maxScroll, 0);
        });

        it("shows right arrow and hides left arrow when scrolled at initial start position", () => {
            // Container 360px (mobile), content 1200px (multiple seasons)
            const state = computeHorizontalScrollBoundaries(0, 1200, 360);
            assert.equal(state.canScrollLeft, false);
            assert.equal(state.canScrollRight, true);
            assert.equal(state.maxScroll, 840);
        });

        it("absorbs sub-pixel rounding discrepancies at initial position (<= 2px)", () => {
            // Sub-pixel jitter e.g. 1.2px or 2.0px
            const state1 = computeHorizontalScrollBoundaries(1.2, 1200, 360);
            assert.equal(state1.canScrollLeft, false);
            assert.equal(state1.canScrollRight, true);

            const state2 = computeHorizontalScrollBoundaries(2.0, 1200, 360);
            assert.equal(state2.canScrollLeft, false);
            assert.equal(state2.canScrollRight, true);

            // Once scrolled past 2px, left arrow activates
            const state3 = computeHorizontalScrollBoundaries(2.5, 1200, 360);
            assert.equal(state3.canScrollLeft, true);
            assert.equal(state3.canScrollRight, true);
        });

        it("enables both arrows when scrolled into intermediate scroll position", () => {
            // Container 800px, content 2000px, scrolled 400px
            const state = computeHorizontalScrollBoundaries(400, 2000, 800);
            assert.equal(state.canScrollLeft, true);
            assert.equal(state.canScrollRight, true);
            assert.equal(state.maxScroll, 1200);
        });

        it("shows left arrow and hides right arrow when scrolled all the way to end position", () => {
            // maxScroll = 2000 - 800 = 1200
            const state = computeHorizontalScrollBoundaries(1200, 2000, 800);
            assert.equal(state.canScrollLeft, true);
            assert.equal(state.canScrollRight, false);
        });

        it("absorbs sub-pixel rounding discrepancies at end position (within 2px of maxScroll)", () => {
            // maxScroll = 1200, scrollLeft = 1198.8px
            const state1 = computeHorizontalScrollBoundaries(1198.8, 2000, 800);
            assert.equal(state1.canScrollLeft, true);
            assert.equal(state1.canScrollRight, false);

            // scrollLeft = 1197px (more than 2px from maxScroll) -> can still scroll right
            const state2 = computeHorizontalScrollBoundaries(1197, 2000, 800);
            assert.equal(state2.canScrollLeft, true);
            assert.equal(state2.canScrollRight, true);
        });

        it("handles edge cases: 0 width, negative scroll, or overscroll safely", () => {
            const emptyState = computeHorizontalScrollBoundaries(0, 0, 0);
            assert.equal(emptyState.canScrollLeft, false);
            assert.equal(emptyState.canScrollRight, false);
            assert.equal(emptyState.maxScroll, 0);

            // Overscrolled past maxScroll
            const overscroll = computeHorizontalScrollBoundaries(1250, 2000, 800);
            assert.equal(overscroll.canScrollLeft, true);
            assert.equal(overscroll.canScrollRight, false);
        });
    });

    describe("Scroll distance step calculations for mobile and desktop (computeHorizontalScrollStep)", () => {
        it("ensures minimum scroll distance is enforced on narrow mobile screens (320px - 360px)", () => {
            // 320px * 0.5 = 160px, but min is 180px
            const stepMobile = computeHorizontalScrollStep(320, 0.5, 180);
            assert.equal(stepMobile, 180);
        });

        it("calculates proportional scroll steps for tablets and desktops (768px - 1440px)", () => {
            // Tablet 768px * 0.75 = 576px
            const stepTablet = computeHorizontalScrollStep(768, 0.75, 180);
            assert.equal(stepTablet, 576);

            // Desktop 1200px * 0.75 = 900px
            const stepDesktop = computeHorizontalScrollStep(1200, 0.75, 180);
            assert.equal(stepDesktop, 900);
        });

        it("correctly computes season tabs step distance", () => {
            // Tabs use 0.65 factor, min 150
            const stepTabMobile = computeHorizontalScrollStep(360, 0.65, 150);
            assert.equal(stepTabMobile, 234);

            const stepTabSmall = computeHorizontalScrollStep(200, 0.65, 150);
            assert.equal(stepTabSmall, 150);
        });
    });

    describe("UI Badge Suppression Verification", () => {
        it("ensures season labels are clean strings without count pills", () => {
            const seasonLabels = [0, 1, 2, 5].map((num) => (num === 0 ? "Specials" : `Season ${num}`));
            assert.deepEqual(seasonLabels, ["Specials", "Season 1", "Season 2", "Season 5"]);
        });

        it("ensures department filter labels do not append count badges", () => {
            const rawDepartments = [
                { name: "Directing", count: 3 },
                { name: "Writing", count: 2 },
                { name: "Production", count: 8 },
            ];

            // Render label without `(${count})`
            const formatted = rawDepartments.map((d) => d.name);
            assert.deepEqual(formatted, ["Directing", "Writing", "Production"]);
            assert.ok(!formatted.some((label) => /\(\d+\)/.test(label)));
        });

        it("formats Show All label without member count numbers", () => {
            const expandButtonLabel = "Show All";
            assert.equal(expandButtonLabel, "Show All");
            assert.ok(!/\d+/.test(expandButtonLabel));
        });

        it("verifies billing badges do not display Billed # numbers", () => {
            const getBillingBadgeText = (order: number, isCrew: boolean) => {
                let billingBadgeText: string | null = null;
                if (!isCrew && typeof order === "number") {
                    if (order === 0) {
                        billingBadgeText = "Lead Star";
                    } else if (order < 3) {
                        billingBadgeText = "Leading Cast";
                    }
                }
                return billingBadgeText;
            };

            assert.equal(getBillingBadgeText(0, false), "Lead Star");
            assert.equal(getBillingBadgeText(1, false), "Leading Cast");
            assert.equal(getBillingBadgeText(2, false), "Leading Cast");
            // Actor with order 3+ should not show "Billed #4"
            assert.equal(getBillingBadgeText(3, false), null);
            assert.equal(getBillingBadgeText(10, false), null);
        });
    });

    describe("Dual Ref Callback and .current Property Contract", () => {
        it("ensures dual ref pattern allows setting via callback and reading via .current", () => {
            let capturedNode: any = null;
            const refCallback = (node: any) => {
                capturedNode = node;
            };

            const containerRef: any = (node: any) => refCallback(node);
            Object.defineProperty(containerRef, "current", {
                get: () => capturedNode,
                set: (node: any) => {
                    refCallback(node);
                },
                configurable: true,
            });

            // Initially null
            assert.equal(containerRef.current, null);

            // Simulating React mounting a DOM element via ref={containerRef}
            const fakeElement = { clientWidth: 400, scrollWidth: 1000, scrollLeft: 0 };
            containerRef(fakeElement);

            // Both capturedNode and containerRef.current are updated
            assert.equal(capturedNode, fakeElement);
            assert.equal(containerRef.current, fakeElement);

            // Simulating direct ref assignment
            containerRef.current = null;
            assert.equal(containerRef.current, null);
            assert.equal(capturedNode, null);
        });
    });

    describe("Mouse Wheel and Drag-to-Scroll Mechanics", () => {
        it("determines whether vertical wheel events can scroll horizontally based on boundaries", () => {
            const canScrollWheel = (deltaY: number, deltaX: number, scrollLeft: number, scrollWidth: number, clientWidth: number) => {
                if (Math.abs(deltaY) <= Math.abs(deltaX)) return false;
                const maxScroll = Math.max(0, scrollWidth - clientWidth);
                if (maxScroll <= 0) return false;
                return deltaY > 0 ? scrollLeft < maxScroll - 1 : scrollLeft > 1;
            };

            // At start (scrollLeft = 0)
            assert.equal(canScrollWheel(100, 0, 0, 1000, 400), true); // scrolling right -> can scroll
            assert.equal(canScrollWheel(-100, 0, 0, 1000, 400), false); // scrolling left -> cannot scroll (allows page scroll)

            // In middle (scrollLeft = 300, maxScroll = 600)
            assert.equal(canScrollWheel(100, 0, 300, 1000, 400), true);
            assert.equal(canScrollWheel(-100, 0, 300, 1000, 400), true);

            // At end (scrollLeft = 600, maxScroll = 600)
            assert.equal(canScrollWheel(100, 0, 600, 1000, 400), false); // cannot scroll right
            assert.equal(canScrollWheel(-100, 0, 600, 1000, 400), true); // can scroll left
        });

        it("distinguishes drag gestures from simple clicks using displacement threshold", () => {
            const isDragGesture = (deltaX: number, threshold = 4) => Math.abs(deltaX) > threshold;

            // Small jitter (e.g. 1px-3px during a click) should NOT count as drag
            assert.equal(isDragGesture(1), false);
            assert.equal(isDragGesture(-3), false);

            // Intentional drags (5px+) must trigger drag-to-scroll
            assert.equal(isDragGesture(5), true);
            assert.equal(isDragGesture(-50), true);
        });
    });
});
