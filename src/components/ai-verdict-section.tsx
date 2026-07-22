"use client";

import { useState } from "react";
import { getMediaVerdictAction } from "@/app/actions";
import { AIVerdictSkeleton } from "@/components/ai-result-skeletons";
import { showAIRateLimitToast } from "@/components/ai-rate-limit-toast";
import { ExpandableText } from "@/components/ui/expandable-text";
import { Heart, Quote, Sparkles, User, Zap } from "lucide-react";

type AIRateLimitNotice = {
    limit: number;
    count: number;
    retryAfterSeconds: number;
    resetAt: number;
};

type AIVerdict = {
    verdict: string;
    reason: string;
    for_whom: string;
    feeling: string;
    ending_vibe: string;
    critics_consensus?: string;
    aiMeta?: {
        source?: string;
        rateLimit?: AIRateLimitNotice;
    };
};

interface AIVerdictSectionProps {
    mediaType: "movie" | "tv";
    id: number;
    title: string;
    releaseDate?: string;
}

export function AIVerdictSection({ mediaType, id, title, releaseDate }: AIVerdictSectionProps) {
    const [insights, setInsights] = useState<AIVerdict | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function runVerdict() {
        setLoading(true);
        setError(null);

        try {
            const response = await getMediaVerdictAction(mediaType, id, title, releaseDate);

            if (response.rateLimit) {
                showAIRateLimitToast(response.rateLimit);
            }

            if (!response.data) {
                setInsights(null);
                setError("AI verdict is unavailable right now. Try again in a moment.");
                return;
            }

            setInsights(response.data);
        } catch (err) {
            console.error("Failed to run AI verdict", err);
            setInsights(null);
            setError("AI verdict failed. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <AIVerdictSkeleton />;
    }

    if (!insights) {
        return (
            <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 p-6">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Sparkles className="h-24 w-24 text-white" />
                </div>
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-300">
                            <Sparkles className="h-5 w-5" />
                            AI Verdict
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-gray-300">
                            Generate a quick verdict, audience fit, emotional vibe, and critic-style summary for this {mediaType === "movie" ? "movie" : "series"}.
                        </p>
                        {error && <p className="text-sm text-red-300">{error}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={runVerdict}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200"
                    >
                        <Sparkles className="h-4 w-4" />
                        Run AI Verdict
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-1">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-6 shadow-lg transform transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles className="h-24 w-24 text-white" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                            <span className="text-sm font-bold text-indigo-300 uppercase tracking-wider">AI Verdict</span>
                        </div>
                        <button
                            type="button"
                            onClick={runVerdict}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                        >
                            Refresh
                        </button>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{insights.verdict}</h3>
                    <p className="text-lg text-gray-200 italic mb-6">&quot;{insights.reason}&quot;</p>

                    <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-indigo-300 mb-1">
                                <User className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">For Whom</span>
                            </div>
                            <p className="text-sm text-gray-300 font-medium leading-normal">{insights.for_whom}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-pink-300 mb-1">
                                <Heart className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Feeling</span>
                            </div>
                            <p className="text-sm text-gray-300 font-medium leading-normal">{insights.feeling}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-amber-300 mb-1">
                                <Zap className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Ending Vibe</span>
                            </div>
                            <p className="text-sm text-gray-300 font-medium leading-normal">{insights.ending_vibe}</p>
                        </div>
                    </div>

                    {insights.critics_consensus && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 text-emerald-300 mb-2">
                                <Quote className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Critics Consensus</span>
                            </div>
                            <ExpandableText text={insights.critics_consensus} maxLines={3} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
