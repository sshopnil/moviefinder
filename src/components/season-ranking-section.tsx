"use client";

import { getSeasonRankingAction } from "@/app/actions";
import { BrainLoader } from "@/components/brain-loader";
import { SeasonRanking } from "@/components/season-ranking";
import { Season } from "@/types/movie";
import { Loader2, Trophy } from "lucide-react";
import { useState, useTransition } from "react";

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
    const [isPending, startTransition] = useTransition();

    function runRanking() {
        setError(null);

        startTransition(async () => {
            try {
                const result = await getSeasonRankingAction(title, seasons);

                if (!result || result.length === 0) {
                    setRankings(null);
                    setError("Season ranking is unavailable right now.");
                    return;
                }

                setRankings(result);
            } catch (error) {
                console.error("Failed to rank seasons", error);
                setRankings(null);
                setError("Season ranking failed. Try again in a moment.");
            }
        });
    }

    if (isPending) {
        return (
            <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <BrainLoader variant="section" message="RANKING SEASONS" />
            </div>
        );
    }

    if (rankings) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={runRanking}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        <Trophy className="h-4 w-4" />
                        Rank Again
                    </button>
                </div>
                <SeasonRanking rankings={rankings} seasons={seasons} />
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
