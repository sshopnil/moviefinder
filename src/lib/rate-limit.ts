type RateLimitBucket = {
    count: number;
    resetAt: number;
};

export function getMaxBucketEntries(): number {
    const val = process.env.MAX_BUCKET_ENTRIES;
    if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 2000;
}

const buckets = new Map<string, RateLimitBucket>();

export function pruneBuckets(now: number) {
    const maxEntries = getMaxBucketEntries();
    const targetSize = Math.floor(maxEntries * 0.9);
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now || buckets.size > targetSize) {
            buckets.delete(key);
        }
        if (buckets.size <= targetSize) break;
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
    const maxEntries = getMaxBucketEntries();

    if (!existing || existing.resetAt <= now) {
        if (buckets.size >= maxEntries) {
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

export async function getClientIp(customHeaders?: Headers): Promise<string> {
    try {
        let headerList = customHeaders;
        if (!headerList) {
            const { headers } = await import("next/headers");
            headerList = await headers();
        }
        const realIp = headerList.get("x-real-ip");
        if (realIp && realIp.trim()) {
            return realIp.trim();
        }
        const forwardedFor = headerList.get("x-forwarded-for");
        if (forwardedFor) {
            const ips = forwardedFor.split(",").map(ip => ip.trim()).filter(Boolean);
            if (ips.length > 0) {
                return ips[ips.length - 1];
            }
        }
    } catch {
        // Fallback when called outside request context
    }
    return "anonymous";
}

