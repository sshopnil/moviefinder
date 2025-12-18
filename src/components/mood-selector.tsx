"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MoodSelectorProps {
    onMoodSubmit: (mood: string) => void;
    isLoading?: boolean;
}

export function MoodSelector({ onMoodSubmit, isLoading }: MoodSelectorProps) {
    const [mood, setMood] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mood.trim()) {
            onMoodSubmit(mood);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-8">
            <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4 text-white/80">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    <h3 className="text-lg font-medium">Find by Mood (AI)</h3>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        placeholder="How are you feeling? (e.g., 'Mind-bending sci-fi')"
                        className="flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors text-sm sm:text-base"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !mood.trim()}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] whitespace-nowrap"
                    >
                        {isLoading ? "Thinking..." : "AI Search"}
                    </button>
                </form>
            </div>
        </div>
    );
}
