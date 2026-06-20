"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type AIRateLimitNotice = {
    limit: number;
    count: number;
    retryAfterSeconds: number;
    resetAt: number;
};

const EVENT_NAME = "moviefinder:ai-rate-limit";

export function showAIRateLimitToast(rateLimit: AIRateLimitNotice) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: rateLimit }));
}

function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;

    if (minutes <= 0) return `${remainder}s`;
    return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

export function AIRateLimitToast() {
    const [notice, setNotice] = useState<AIRateLimitNotice | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);

    useEffect(() => {
        function handleRateLimit(event: Event) {
            const detail = (event as CustomEvent<AIRateLimitNotice>).detail;
            setNotice(detail);
            setRemainingSeconds(Math.max(0, Math.ceil((detail.resetAt - Date.now()) / 1000)));
        }

        window.addEventListener(EVENT_NAME, handleRateLimit);
        return () => window.removeEventListener(EVENT_NAME, handleRateLimit);
    }, []);

    useEffect(() => {
        if (!notice) return;

        const interval = window.setInterval(() => {
            const nextRemaining = Math.max(0, Math.ceil((notice.resetAt - Date.now()) / 1000));
            setRemainingSeconds(nextRemaining);
            if (nextRemaining <= 0) {
                setNotice(null);
            }
        }, 1000);

        return () => window.clearInterval(interval);
    }, [notice]);

    if (!notice) return null;

    return (
        <div className="fixed inset-x-4 top-4 z-[100] flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md rounded-lg border border-yellow-500/30 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-yellow-500/15 p-2 text-yellow-300">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-sm font-semibold text-white">AI request limit reached</h2>
                            <button
                                type="button"
                                onClick={() => setNotice(null)}
                                className="rounded p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                                aria-label="Dismiss"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-1 text-sm leading-5 text-zinc-300">
                            The app has used {notice.limit} AI requests in this minute. Try again in{" "}
                            <span className="font-semibold text-yellow-200">{formatTime(remainingSeconds)}</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
