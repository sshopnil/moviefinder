"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type SearchType = 'mood' | 'description';

interface MoodSelectorProps {
    onSearch: (query: string, type: SearchType) => void;
    isLoading?: boolean;
}

export function MoodSelector({ onSearch, isLoading }: MoodSelectorProps) {
    const [query, setQuery] = useState("");
    const [searchType, setSearchType] = useState<SearchType>('mood');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query, searchType);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-8">
            <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        type="button"
                        onClick={() => setSearchType('mood')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium",
                            searchType === 'mood' 
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" 
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Sparkles className="h-4 w-4" />
                        By Mood
                    </button>
                    <button
                        type="button"
                        onClick={() => setSearchType('description')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm font-medium",
                            searchType === 'description' 
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <span className="text-lg leading-none">📝</span>
                        By Plot Description
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                            searchType === 'mood' 
                                ? "How are you feeling? (e.g., 'I want a mind-bending sci-fi')"
                                : "Describe the movie... (e.g., 'A thief who enters people's dreams to steal secrets')"
                        }
                        className="flex-1 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className={cn(
                            "px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all",
                            searchType === 'mood'
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600"
                                : "bg-gradient-to-r from-blue-600 to-cyan-600"
                        )}
                    >
                        {isLoading ? "Thinking..." : "AI Search"}
                    </button>
                </form>
            </div>
        </div>
    );
}
