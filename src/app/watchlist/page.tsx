import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWatchlistAction } from "@/actions/watchlist";
import { MovieBrowser } from "@/components/movie-browser";

export default async function WatchlistPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Fetch movies. No need for genres as MovieBrowser derives them.
    const watchlist = await getWatchlistAction();

    return (
        <main className="container mx-auto px-4 py-24 min-h-screen">
            <MovieBrowser
                movies={watchlist}
                title="My Watchlist"
                description={`Manage your saved movies. You have ${watchlist.length} items in your list.`}
            />
        </main>
    );
}
