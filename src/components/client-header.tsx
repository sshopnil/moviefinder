"use client";

import { SearchBar } from "@/components/search-bar";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ClientHeader() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (query: string, type: "movie" | "tv", isAI: boolean) => {
        if (!query.trim()) return;
        startTransition(() => {
            const encoded = encodeURIComponent(query.trim());
            if (isAI) {
                router.push(`/?mood=${encoded}&type=${type}`);
            } else {
                router.push(`/?q=${encoded}&type=${type}`);
            }
        });
    };

    return (
        <SearchBar onSearch={handleSearch} searchLoading={isPending} />
    );
}
