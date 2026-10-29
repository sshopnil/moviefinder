"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

export interface UseHorizontalScrollOptions {
    scrollFactor?: number;
    minScrollDistance?: number;
    enableWheel?: boolean;
    enableDrag?: boolean;
}

export type HorizontalScrollContainerRef = React.RefCallback<HTMLDivElement> & {
    current: HTMLDivElement | null;
};

export function computeHorizontalScrollBoundaries(
    scrollLeft: number,
    scrollWidth: number,
    clientWidth: number
) {
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    // Tolerance of 2px to absorb sub-pixel browser discrepancies
    const canScrollLeft = scrollLeft > 2;
    const canScrollRight = maxScroll > 2 && scrollLeft < maxScroll - 2;
    return { canScrollLeft, canScrollRight, maxScroll };
}

export function computeHorizontalScrollStep(
    clientWidth: number,
    scrollFactor = 0.75,
    minScrollDistance = 180
) {
    return Math.max(clientWidth * scrollFactor, minScrollDistance);
}

export function useHorizontalScroll(options: UseHorizontalScrollOptions = {}) {
    const {
        scrollFactor = 0.75,
        minScrollDistance = 180,
        enableWheel = true,
        enableDrag = true,
    } = options;
    const [element, setElement] = useState<HTMLDivElement | null>(null);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = elementRef.current;
        if (!el) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }

        const { canScrollLeft: canLeft, canScrollRight: canRight } = computeHorizontalScrollBoundaries(
            el.scrollLeft,
            el.scrollWidth,
            el.clientWidth
        );

        setCanScrollLeft(canLeft);
        setCanScrollRight(canRight);
    }, []);

    const scroll = useCallback(
        (direction: "left" | "right") => {
            const el = elementRef.current;
            if (!el) return;

            const distance = computeHorizontalScrollStep(el.clientWidth, scrollFactor, minScrollDistance);
            el.scrollBy({
                left: direction === "left" ? -distance : distance,
                behavior: "smooth",
            });

            // Re-check state during and after smooth scrolling animation completes
            setTimeout(updateScrollState, 150);
            setTimeout(updateScrollState, 350);
            setTimeout(updateScrollState, 500);
        },
        [scrollFactor, minScrollDistance, updateScrollState]
    );

    const scrollLeft = useCallback(() => scroll("left"), [scroll]);
    const scrollRight = useCallback(() => scroll("right"), [scroll]);

    // Dual callback ref + ref object pattern for robust lifecycle attachment
    const refCallback = useCallback((node: HTMLDivElement | null) => {
        elementRef.current = node;
        setElement(node);
    }, []);

    const containerRef = useRef<HorizontalScrollContainerRef | null>(null);
    if (!containerRef.current) {
        const fn = ((node: HTMLDivElement | null) => {
            refCallback(node);
        }) as HorizontalScrollContainerRef;

        Object.defineProperty(fn, "current", {
            get: () => elementRef.current,
            set: (node: HTMLDivElement | null) => {
                refCallback(node);
            },
            configurable: true,
        });

        containerRef.current = fn;
    }
    const stableContainerRef = containerRef.current as HorizontalScrollContainerRef;

    useEffect(() => {
        if (!element) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }

        updateScrollState();

        const handleScroll = () => {
            updateScrollState();
        };

        element.addEventListener("scroll", handleScroll, { passive: true });
        element.addEventListener("scrollend", handleScroll, { passive: true });

        // Wheel event: translate vertical scroll wheel (deltaY) into horizontal scroll
        const handleWheel = (e: WheelEvent) => {
            if (!enableWheel || e.shiftKey) return;

            // If vertical scroll is dominant, scroll horizontally
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
                if (maxScroll <= 0) return;

                const isScrollingRight = e.deltaY > 0;
                const canScrollInDir = isScrollingRight
                    ? element.scrollLeft < maxScroll - 1
                    : element.scrollLeft > 1;

                if (canScrollInDir) {
                    e.preventDefault();
                    element.scrollLeft += e.deltaY;
                    updateScrollState();
                }
            }
        };

        element.addEventListener("wheel", handleWheel, { passive: false });

        // Drag-to-scroll support for mouse desktop interactions
        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;
        let hasMoved = false;

        const handlePointerDown = (e: PointerEvent) => {
            if (!enableDrag || e.button !== 0 || e.pointerType === "touch") return;

            // Avoid drag interception on interactive buttons or form inputs
            const target = e.target as HTMLElement | null;
            if (target && (target.closest("button") || target.closest("input"))) {
                return;
            }

            isDown = true;
            startX = e.clientX;
            startScrollLeft = element.scrollLeft;
            hasMoved = false;
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDown) return;
            const deltaX = e.clientX - startX;
            if (!hasMoved && Math.abs(deltaX) > 4) {
                hasMoved = true;
                element.style.cursor = "grabbing";
                element.style.userSelect = "none";
            }
            if (hasMoved) {
                e.preventDefault();
                element.scrollLeft = startScrollLeft - deltaX;
                updateScrollState();
            }
        };

        const handlePointerUp = () => {
            if (!isDown) return;
            isDown = false;
            element.style.cursor = "";
            element.style.userSelect = "";

            if (hasMoved) {
                // Prevent click on underlying links or cards when user was dragging
                const preventClick = (clickEvent: MouseEvent) => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                };
                window.addEventListener("click", preventClick, { capture: true, once: true });
                setTimeout(() => {
                    window.removeEventListener("click", preventClick, { capture: true });
                }, 100);
            }
        };

        element.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);

        if (typeof window !== "undefined") {
            window.addEventListener("resize", updateScrollState);
        }

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => {
                updateScrollState();
            });
            resizeObserver.observe(element);
            for (let i = 0; i < element.children.length; i++) {
                const child = element.children[i];
                if (child) resizeObserver.observe(child);
            }
        }

        let mutationObserver: MutationObserver | null = null;
        if (typeof MutationObserver !== "undefined") {
            mutationObserver = new MutationObserver(() => {
                updateScrollState();
                if (resizeObserver && element) {
                    for (let i = 0; i < element.children.length; i++) {
                        const child = element.children[i];
                        if (child) resizeObserver.observe(child);
                    }
                }
            });
            mutationObserver.observe(element, { childList: true, subtree: false });
        }

        // Run after brief delays to catch late layout adjustments (e.g. image loads)
        const t1 = setTimeout(updateScrollState, 150);
        const t2 = setTimeout(updateScrollState, 400);

        return () => {
            element.removeEventListener("scroll", handleScroll);
            element.removeEventListener("scrollend", handleScroll);
            element.removeEventListener("wheel", handleWheel);
            element.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
            if (typeof window !== "undefined") {
                window.removeEventListener("resize", updateScrollState);
            }
            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [element, enableDrag, enableWheel, updateScrollState]);

    return useMemo(() => ({
        containerRef: stableContainerRef,
        canScrollLeft,
        canScrollRight,
        scrollLeft,
        scrollRight,
        updateScrollState,
    }), [stableContainerRef, canScrollLeft, canScrollRight, scrollLeft, scrollRight, updateScrollState]);
}
