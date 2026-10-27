type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const MAX_BUCKET_ENTRIES = 2000;
const buckets = new Map<string, RateLimitBucket>();

function pruneBuckets(now: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }

    while (buckets.size >= MAX_BUCKET_ENTRIES) {
        const oldestKey = buckets.keys().next().value;
        if (!oldestKey) break;
        buckets.delete(oldestKey);
    }
}

export type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfterSeconds: number;
};

export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
): RateLimitResult {
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        if (buckets.size >= MAX_BUCKET_ENTRIES) {
            pruneBuckets(now);
        }
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return {
            allowed: true,
            remaining: Math.max(0, limit - 1),
            resetAt,
            retryAfterSeconds: Math.ceil(windowMs / 1000),
        };
    }

    if (existing.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: existing.resetAt,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }

    existing.count += 1;
    return {
        allowed: true,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
}

export async function getClientIp(): Promise<string> {
    try {
        const { headers } = await import("next/headers");
        const headerList = await headers();
        const forwardedFor = headerList.get("x-forwarded-for");
        if (forwardedFor) {
            return forwardedFor.split(",")[0].trim();
        }
        const realIp = headerList.get("x-real-ip");
        if (realIp) {
            return realIp.trim();
        }
    } catch {
        // Fallback when called outside request context
    }
    return "anonymous";
}
