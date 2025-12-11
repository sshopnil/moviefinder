"use client";

import { SearchBar } from "@/components/search-bar";
import { MoodSelector, SearchType } from "@/components/mood-selector";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientHeader() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const handleSearch = (query: string) => {
        if (!query.trim()) return;
        setSearchLoading(true);
        router.push(`/?q=${encodeURIComponent(query)}`);
        // Reset loading state after navigation completes usually happens automatically by Next.js if we used useTransition 
        // but here we just show it briefly.
        setTimeout(() => setSearchLoading(false), 2000);
    };

    const handleAISearch = (query: string, type: SearchType) => {
        if (!query.trim()) return;
        setIsLoading(true);
        const param = type === 'mood' ? 'mood' : 'description';
        router.push(`/?${param}=${encodeURIComponent(query)}`);
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <>
            <SearchBar onSearch={handleSearch} searchLoading={searchLoading} />
            <MoodSelector onSearch={handleAISearch} isLoading={isLoading} />
        </>
    );
}
