export interface ExternalRatings {
    imdb?: string;
    rottenTomatoes?: string;
    metacritic?: string;
    awards?: string;
}

let omdbCooldownUntil = 0;

export function resetOmdbCooldown() {
    omdbCooldownUntil = 0;
}

export function isOmdbInCooldown(): boolean {
    return Date.now() < omdbCooldownUntil;
}

export async function getExternalRatings(title: string, year?: string): Promise<ExternalRatings | null> {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
        console.warn("OMDB_API_KEY is missing. Cannot fetch external ratings.");
        return null;
    }

    if (Date.now() < omdbCooldownUntil) {
        return null;
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
                console.warn("[OMDb] Daily request limit reached. Cooling down for 15 minutes.");
                omdbCooldownUntil = Date.now() + 15 * 60 * 1000;
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

        return ratings;
    } catch (error) {
        console.error("OMDb Fetch Error:", error);
        return null;
    }
}
