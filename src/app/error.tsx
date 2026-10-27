"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Unhandled route error:", error);
    }, [error]);

    return (
        <main className="container mx-auto px-4 py-24 min-h-[80vh] flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl bg-white/5 border border-white/10 p-8 text-center space-y-6 backdrop-blur-md">
                <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7 text-red-400" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                    <p className="text-sm text-gray-400">
                        We couldn&apos;t load this page right now. This may be due to a temporary network or service issue.
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                    >
                        <Home className="h-4 w-4" />
                        Back Home
                    </Link>
                </div>
            </div>
        </main>
    );
}

