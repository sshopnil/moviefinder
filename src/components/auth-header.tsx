
import Link from "next/link";
import { User, LogOut, Home } from "lucide-react";
import { auth } from "@/auth";
import { HeaderSearchIcon } from "./header-search-icon";

export async function AuthHeader() {
    const session = await auth();

    return (
        <div className="absolute top-4 right-4 z-20 flex gap-4 items-center">
            <HeaderSearchIcon />
            <Link
                href="/"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5 backdrop-blur-sm"
                title="Home"
            >
                <Home className="h-5 w-5" />
            </Link>

            {session?.user ? (
                <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm transition-colors border border-white/5">
                    <User className="h-4 w-4" />
                    <span>{session.user.name?.split(" ")[0]}</span>
                </Link>
            ) : (
                <>
                    <Link href="/login" className="text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm transition-colors border border-white/5">
                        Login
                    </Link>
                    <Link href="/signup" className="text-black hover:bg-white/90 font-medium px-4 py-2 bg-white rounded-lg transition-colors shadow-lg shadow-white/10">
                        Sign Up
                    </Link>
                </>
            )}
        </div>
    );
}
