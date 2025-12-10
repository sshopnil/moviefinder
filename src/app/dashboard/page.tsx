

import { auth } from "@/auth";
import { getUserWatchlistAction } from "@/actions/watchlist";
import { MovieGrid } from "@/components/movie-grid";
import { redirect } from "next/navigation";
import Image from "next/image";
import { signOutAction } from "@/actions/signout";

function SignOutButton() {
    return (
        <form action={signOutAction}>
            <button type="submit" className="text-sm text-red-400 hover:text-red-300 transition-colors">
                Sign Out
            </button>
        </form>
    );
}

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const movies = await getUserWatchlistAction();

    return (
        <div className="min-h-screen container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-12 p-6 rounded-2xl bg-white/5 border border-white/10 mt-10">
                <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500">
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt={session.user.name || "User"}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-2xl font-bold text-white">
                            {session.user.name?.[0]?.toUpperCase() || "U"}
                        </div>
                    )}
                </div>

                <div className="text-center md:text-left flex-1">
                    <h1 className="text-2xl font-bold text-white">{session.user.name}</h1>
                    <p className="text-gray-400">{session.user.email}</p>
                </div>

                <div className="flex gap-4">
                    <SignOutButton />
                </div>
            </div>

            <MovieGrid movies={movies} title="My Watchlist" />
        </div>
    );
}
