import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function normalizeScore(score: unknown): number {
    if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
        return 0;
    }
    // Decimal scale 0 < score < 1 (e.g. 0.85 -> 85, 0.08 -> 8)
    if (score < 1) {
        return Math.round(score * 100);
    }
    // 1-10 decimal rating scale with fractional part (e.g. 8.5 -> 85, 9.2 -> 92)
    if (score <= 10 && !Number.isInteger(score)) {
        return Math.round(score * 10);
    }
    // 0-100 scale (integers or scores > 10)
    if (score > 100) {
        return 100;
    }
    return Math.round(score);
}
