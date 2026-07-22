"use client";

import { SeasonRanking } from "@/components/season-ranking";
import { Season } from "@/types/movie";
import { Loader2, Trophy } from "lucide-react";
import { useState } from "react";

type Ranking = {
    season_number: number;
    rank: number;
    score: number;
    verdict: string;
    reason: string;
    audience_reception: string;
    critics_consensus: string;
};

interface SeasonRankingSectionProps {
    title: string;
    seasons: Season[];
}

export function SeasonRankingSection({ title, seasons }: SeasonRankingSectionProps) {
    const [rankings, setRankings] = useState<Ranking[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    function runRanking() {
        setError(null);
        setRankings([]);
        setIsPending(true);

        void (async () => {
            try {
                const response = await fetch("/api/ai/recommendations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "season-ranking", title, seasons }),
                });

                if (!response.ok || !response.body) throw new Error("Failed to start season ranking stream.");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let resultCount = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    buffer += decoder.decode(value, { stream: !done });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const event = JSON.parse(line);

                        if (event.type === "item") {
                            resultCount++;
                            setRankings((current) => [...(current || []), event.item].sort((a, b) => a.rank - b.rank));
                        } else if (event.type === "error" || event.type === "rateLimit") {
                            setError("Season ranking is unavailable right now.");
                        }
                    }

                    if (done) break;
                }

                if (resultCount === 0) {
                    setRankings(null);
                    setError("Season ranking is unavailable right now.");
                }
            } catch (error) {
                console.error("Failed to rank seasons", error);
                setRankings(null);
                setError("Season ranking failed. Try again in a moment.");
            } finally {
                setIsPending(false);
            }
        })();
    }

    if (rankings || isPending) {
        const targetCount = Math.min(Math.max(seasons.length, 2), 5);
        return (
            <div className="space-y-4">
                {!isPending && rankings && rankings.length > 0 && <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={runRanking}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        <Trophy className="h-4 w-4" />
                        Rank Again
                    </button>
                </div>}
                <SeasonRanking
                    rankings={rankings || []}
                    seasons={seasons}
                    pendingCount={isPending ? Math.max(0, targetCount - (rankings?.length || 0)) : 0}
                />
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                        <Trophy className="h-5 w-5 text-yellow-400" />
                        Season Power Rankings
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-gray-400">
                        Use AI to rank this series&apos; seasons by overall quality, critics, and viewer sentiment.
                    </p>
                    {error && <p className="text-sm text-red-300">{error}</p>}
                </div>
                <button
                    type="button"
                    onClick={runRanking}
                    disabled={isPending}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200 disabled:opacity-60"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Rank Seasons
                </button>
            </div>
        </div>
    );
}
