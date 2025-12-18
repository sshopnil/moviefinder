
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Home, Heart, Github } from "lucide-react";
import { HeaderSearchIcon } from "./header-search-icon";
import { ProfileMenu } from "./profile-menu";
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
            <div className="w-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link
                        href="/"
                        className={cn(
                            "text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 transition-all duration-300",
                            isScrolled ? "opacity-100 flex" : "hidden md:flex"
                        )}
                    >
                        MovieFinder
                    </Link>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <HeaderSearchIcon />

                    <Link
                        href="/"
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 hidden xs:flex"
                        title="Home"
                    >
                        <Home className="h-5 w-5" />
                    </Link>

                    <Link
                        href="https://github.com/sshopnil/moviefinder"
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 hidden sm:flex"
                        aria-label="View Source on GitHub"
                        title="GitHub"
                    >
                        <Github className="h-5 w-5" />
                    </Link>

                    {user ? (
                        <>
                            <Link href="/watchlist" className="flex items-center gap-2 text-white hover:text-gray-300 font-medium px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5 text-xs sm:text-sm">
                                <Heart className="h-4 w-4 fill-white text-white" />
                                <span className="hidden sm:inline">Watchlist</span>
                            </Link>
                            <ProfileMenu user={user} />
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/login" className="text-white hover:text-gray-300 font-medium px-3 sm:px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/5 text-xs sm:text-sm">
                                Login
                            </Link>
                            <Link href="/signup" className="text-black hover:bg-white/90 font-bold px-3 sm:px-4 py-2 bg-white rounded-lg transition-colors shadow-lg shadow-white/10 text-xs sm:text-sm">
                                <span className="hidden xs:inline">Sign Up</span>
                                <span className="xs:hidden">Join</span>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header >
    );
}
