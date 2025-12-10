
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { auth } from "@/auth";

export async function AuthHeader() {
    const session = await auth();

    if (session?.user) {
        return (
            <div className="absolute top-4 right-4 z-20 flex gap-4 items-center">
                <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm transition-colors">
                    <User className="h-4 w-4" />
                    <span>{session.user.name?.split(" ")[0]}</span>
                </Link>
            </div>
        );
    }

    return (
        <div className="absolute top-4 right-4 z-20 flex gap-4">
            <Link href="/login" className="text-white hover:text-gray-300 font-medium px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm transition-colors">
                Login
            </Link>
            <Link href="/signup" className="text-black hover:bg-white/90 font-medium px-4 py-2 bg-white rounded-lg transition-colors">
                Sign Up
            </Link>
        </div>
    );
}
