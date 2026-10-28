import connectToDatabase from "./db.ts";
import OMDbCache from "../models/OMDbCache.ts";

export interface ExternalRatings {
    imdb?: string;
    rottenTomatoes?: string;
    metacritic?: string;
    awards?: string;
    notFound?: boolean;
}

let omdbCooldownUntil = 0;

export function resetOmdbCooldown() {
    omdbCooldownUntil = 0;
}

export function isOmdbInCooldown(): boolean {
    return Date.now() < omdbCooldownUntil;
}

export function getOmdbCooldownMs(): number {
    const val = process.env.OMDB_COOLDOWN_MS;
    if (val) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 3600000;
}

function getOMDbCacheKey(title: string, year?: string): string {
    const cleanTitle = (title || "").trim().toLowerCase();
    const cleanYear = year && year !== "undefined" ? year.trim() : "";
    return `omdb:${cleanTitle}:${cleanYear}`;
}

export async function isDBCooldownActive(): Promise<boolean> {
    if (Date.now() < omdbCooldownUntil) return true;
    try {
        if (!process.env.MONGODB_URI) return false;
        await connectToDatabase();
        const cooldownDoc = await OMDbCache.findOne({ key: "__global_cooldown__" }).lean();
        if (cooldownDoc?.cooldownUntil && new Date(cooldownDoc.cooldownUntil).getTime() > Date.now()) {
            omdbCooldownUntil = Math.max(omdbCooldownUntil, new Date(cooldownDoc.cooldownUntil).getTime());
            return true;
        }
    } catch {
        // Fallback to in-memory check on DB failure or in unit test environment
    }
    return false;
}

export async function getCachedRatings(key: string): Promise<ExternalRatings | null> {
    try {
        if (!process.env.MONGODB_URI) return null;
        await connectToDatabase();
        const doc = await OMDbCache.findOne({ key }).lean();
        if (doc && doc.ratings) {
            return doc.ratings as ExternalRatings;
        }
    } catch {
        // Fallback to fetch on DB error or in unit tests
    }
    return null;
}

export async function setCachedRatings(key: string, ratings: ExternalRatings): Promise<void> {
    try {
        if (!process.env.MONGODB_URI) return;
        await connectToDatabase();
        await OMDbCache.findOneAndUpdate(
            { key },
            { $set: { ratings, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch {
        // Non-fatal if DB write fails
    }
}

export async function setDBCooldown(durationMs: number = getOmdbCooldownMs()): Promise<void> {
    const cooldownUntil = new Date(Date.now() + durationMs);
    omdbCooldownUntil = cooldownUntil.getTime();
    try {
        if (!process.env.MONGODB_URI) return;
        await connectToDatabase();
        await OMDbCache.findOneAndUpdate(
            { key: "__global_cooldown__" },
            { $set: { cooldownUntil, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch {
        // Non-fatal if DB write fails
    }
}

export async function getExternalRatings(title: string, year?: string): Promise<ExternalRatings | null> {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
        console.warn("OMDB_API_KEY is missing. Cannot fetch external ratings.");
        return null;
    }

    // In-memory cooldown checked before DB query
    if (Date.now() < omdbCooldownUntil) {
        return null;
    }

    const cacheKey = getOMDbCacheKey(title, year);

    // Concurrent DB queries for cached entry and cooldown
    const [cooldownActive, cached] = await Promise.all([
        isDBCooldownActive(),
        getCachedRatings(cacheKey)
    ]);

    if (cooldownActive) {
        return null;
    }

    if (cached) {
        if ((cached as any).notFound) {
            return null;
        }
        return cached;
    }

    try {
        const yearParam = year && year !== "undefined" && year.trim() !== "" ? `&y=${encodeURIComponent(year.trim())}` : "";
        const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${yearParam}&apikey=${apiKey}`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(8000),
            next: { revalidate: 3600 },
        });
        const data = await res.json();

        if (data.Response === "False") {
            if (typeof data.Error === "string" && data.Error.toLowerCase().includes("request limit")) {
                console.warn("[OMDb] Daily request limit reached. Cooling down for 1 hour across lambdas.");
                await setDBCooldown(getOmdbCooldownMs());
            } else {
                // Negative caching: store { notFound: true } in OMDbCache
                await setCachedRatings(cacheKey, { notFound: true });
            }
            return null;
        }

        const ratings: ExternalRatings = {
            imdb: data.imdbRating && data.imdbRating !== "N/A" ? `${data.imdbRating}/10` : undefined,
            metacritic: data.Metascore && data.Metascore !== "N/A" ? `${data.Metascore}/100` : undefined,
            awards: data.Awards && data.Awards !== "N/A" ? data.Awards : undefined,
        };

        const rt = data.Ratings?.find((r: any) => r.Source === "Rotten Tomatoes");
        if (rt) {
            ratings.rottenTomatoes = rt.Value;
        }

        // Persist ratings to MongoDB cache
        await setCachedRatings(cacheKey, ratings);

        return ratings;
    } catch (error) {
        console.error("OMDb Fetch Error:", error);
        return null;
    }
}

