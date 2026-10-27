export function sanitizePlayerProgress(data: unknown): { progressMins: number; durationMins: number } | null {
    if (!data || typeof data !== "object") return null;

    const record = data as Record<string, any>;
    const rawCurrentTime = record.data?.currentTime ?? record.currentTime ?? record.time;
    const rawDuration = record.data?.duration ?? record.duration;

    const currentTime = typeof rawCurrentTime === "number" && Number.isFinite(rawCurrentTime) ? rawCurrentTime : null;
    const duration = typeof rawDuration === "number" && Number.isFinite(rawDuration) ? rawDuration : null;

    if (currentTime !== null && duration !== null && duration > 0 && currentTime >= 0) {
        const boundedCurrentTime = Math.min(currentTime, duration);
        const progressMins = Math.max(0, Math.floor(boundedCurrentTime / 60));
        const durationMins = Math.max(1, Math.floor(duration / 60));
        return { progressMins, durationMins };
    }
    return null;
}
