"use client";

import { SearchBar } from "@/components/search-bar";
import { MoodSelector } from "@/components/mood-selector";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientHeader() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = (query: string) => {
        if (!query.trim()) return;
        setIsLoading(true);
        router.push(`/?q=${encodeURIComponent(query)}`);
        // Reset loading state after navigation completes usually happens automatically by Next.js if we used useTransition 
        // but here we just show it briefly.
        setTimeout(() => setIsLoading(false), 2000);
    };

    const handleMoodSubmit = (mood: string) => {
        if (!mood.trim()) return;
        setIsLoading(true);
        router.push(`/?mood=${encodeURIComponent(mood)}`);
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <>
            <SearchBar onSearch={handleSearch} />
            <MoodSelector onMoodSubmit={handleMoodSubmit} isLoading={isLoading} />
        </>
    );
}
