"use client";

import { SearchBar } from "@/components/search-bar";
import { MoodSelector } from "@/components/mood-selector";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ClientHeader() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (query: string) => {
        if (!query.trim()) return;
        startTransition(() => {
            router.push(`/?q=${encodeURIComponent(query.trim())}`);
        });
    };

    const handleMoodSubmit = (mood: string) => {
        if (!mood.trim()) return;
        startTransition(() => {
            router.push(`/?mood=${encodeURIComponent(mood.trim())}`);
        });
    };

    return (
        <>
            <SearchBar onSearch={handleSearch} searchLoading={isPending} />
            <MoodSelector onMoodSubmit={handleMoodSubmit} isLoading={isPending} />
        </>
    );
}
