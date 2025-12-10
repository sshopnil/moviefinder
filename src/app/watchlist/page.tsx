import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWatchlistAction, getWatchlistGenresAction } from "@/actions/watchlist";
import { WatchlistFilters } from "@/components/watchlist-filters";
import { WatchlistGrid } from "@/components/watchlist-grid";

export default async function WatchlistPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Await searchParams for Next.js 15+ compatibility
    const params = await searchParams;
    const { query, sortBy, genreId } = params;

    // Ensure params are strings
    const q = typeof query === 'string' ? query : undefined;
    const s = typeof sortBy === 'string' ? sortBy : undefined;
    const g = typeof genreId === 'string' ? genreId : undefined;

    // Fetch movies and available genres in parallel
    const [watchlist, genres] = await Promise.all([
        getWatchlistAction({
            query: q,
            sortBy: s,
            genreId: g,
        }),
        getWatchlistGenresAction()
    ]);

    return (
        <main className="container mx-auto px-4 py-24 min-h-screen">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">My Watchlist</h1>
                <p className="text-gray-400">
                    Manage your saved movies. You have {watchlist.length} items in your list.
                </p>
            </div>

            <WatchlistFilters availableGenres={genres} />

            <WatchlistGrid movies={watchlist} />
        </main>
    );
}
