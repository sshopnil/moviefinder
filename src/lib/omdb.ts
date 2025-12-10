
export interface ExternalRatings {
    imdb?: string;
    rottenTomatoes?: string;
    metacritic?: string;
    awards?: string;
}

export async function getExternalRatings(title: string, year?: string): Promise<ExternalRatings | null> {
    const apiKey = process.env.OMDB_API_KEY;
    if (!apiKey) {
        console.warn("OMDB_API_KEY is missing. Cannot fetch external ratings.");
        return null;
    }

    try {
        const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${year}&apikey=${apiKey}`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();

        if (data.Response === "False") {
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
