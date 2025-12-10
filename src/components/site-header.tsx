
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Home, Heart } from "lucide-react";
import { HeaderSearchIcon } from "./header-search-icon";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
    user?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export function SiteHeader({ user }: SiteHeaderProps) {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out border-b border-transparent",
                isScrolled
                    ? "bg-black/80 backdrop-blur-md py-3 shadow-lg border-white/10"
                    : "bg-transparent py-5"
            )}
        >
            <div className="container mx-auto px-4 flex items-center justify-between">
                {/* Logo - visible when scrolled or always? Let's make it always visible but subtle when top */}
                <Link
                    href="/"
                    className={cn(
                        "text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 transition-opacity duration-300",
                        isScrolled ? "opacity-100" : "opacity-0 md:opacity-100" // Hide on mobile when at top to avoid clutter? or just keep it. Let's fade it in on scroll to avoid duplication with the big Hero logo on home
                    )}
                >
                    MovieFinder
                </Link>

                <div className="flex items-center gap-4">
                    <HeaderSearchIcon />

                    <Link
                        href="/"
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 hidden md:block"
                        title="Home"
                    >
                        <Home className="h-5 w-5" />
                    </Link>

                    {user ? (
                        <>
                            <Link href="/watchlist" className="flex items-center gap-2 text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5 text-sm">
                                <Heart className="h-4 w-4 fill-white text-white" />
                                <span className="hidden sm:inline">Watchlist</span>
                            </Link>
                            <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5 text-sm">
                                <User className="h-4 w-4" />
                                <span className="hidden sm:inline">{user.name?.split(" ")[0]}</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5 text-sm">
                                Login
                            </Link>
                            <Link href="/signup" className="text-black hover:bg-white/90 font-medium px-4 py-2 bg-white rounded-lg transition-colors shadow-lg shadow-white/10 text-sm">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
