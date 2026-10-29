"use client";

import { SearchBar } from "@/components/search-bar";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ClientHeader() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSearch = (
        query: string,
        type: "movie" | "tv" | "person",
        isAI: boolean,
        actor?: { id: number; name: string } | null
    ) => {
        if (!query.trim()) return;
        startTransition(() => {
            const encoded = encodeURIComponent(query.trim());
            if (isAI) {
                if (type === "person" && actor) {
                    const profileParam = (actor as any).profile_path
                        ? `&actorProfile=${encodeURIComponent((actor as any).profile_path)}`
                        : "";
                    router.push(`/?mood=${encoded}&type=person&actorId=${actor.id}&actorName=${encodeURIComponent(actor.name)}${profileParam}`);
                } else {
                    router.push(`/?mood=${encoded}&type=${type}`);
                }
            } else {
                router.push(`/?q=${encoded}&type=${type}`);
            }
        });
    };

    return (
        <SearchBar onSearch={handleSearch} searchLoading={isPending} />
    );
}
