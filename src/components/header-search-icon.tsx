"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

export function HeaderSearchIcon() {
    const pathname = usePathname();
    const isHome = pathname === "/";

    if (isHome) return null;

    return (
        <Link
            href="/"
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 backdrop-blur-sm"
            title="Search Movies"
        >
            <Search className="h-5 w-5" />
        </Link>
    );
}
