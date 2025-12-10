
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWatchlistAction } from "@/actions/watchlist";
import { getFavoriteActorsAction } from "@/actions/favorite-actors";
import { MovieBrowser } from "@/components/movie-browser";
import { PersonBrowser } from "@/components/person-browser";
import Link from "next/link";
import { Film, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ view?: string }>;
};

export default async function WatchlistPage({ searchParams }: Props) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const { view } = await searchParams;
    const isActorsView = view === "actors";

    const watchlist = !isActorsView ? await getWatchlistAction() : [];
    const favoriteActors = isActorsView ? await getFavoriteActorsAction() : [];

    return (
        <main className="container mx-auto px-4 py-24 min-h-screen">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">My Library</h1>
                    <p className="text-gray-400">Manage your saved content</p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl">
                    <Link
                        href="/watchlist"
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${!isActorsView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Film className="h-4 w-4" />
                        Movies
                    </Link>
                    <Link
                        href="/watchlist?view=actors"
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${isActorsView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Users className="h-4 w-4" />
                        Actors
                    </Link>
                </div>
            </div>

            {isActorsView ? (
                <PersonBrowser
                    people={favoriteActors}
                    title="Favorite Actors"
                />
            ) : (
                <MovieBrowser
                    movies={watchlist}
                    title="Watchlist"
                    description={`You have ${watchlist.length} movies in your list.`}
                />
            )}
        </main>
    );
}
