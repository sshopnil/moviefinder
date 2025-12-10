"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export function HeaderSearchIcon() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState("");

    if (isHome) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/?q=${encodeURIComponent(query.trim())}`);
            setExpanded(false);
            setQuery("");
        }
    };

    return (
        <div className="relative">
            {expanded ? (
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                    <input
                        type="text"
                        placeholder="Search movies..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="rounded-md bg-white/10 px-2 py-1 text-sm text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                    />
                    <button type="button" onClick={() => setExpanded(false)} className="p-1 rounded-full hover:bg-white/20">
                        <X className="h-5 w-5 text-white" />
                    </button>
                </form>
            ) : (
                <button
                    onClick={() => setExpanded(true)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 backdrop-blur-sm"
                    title="Search Movies"
                >
                    <Search className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
