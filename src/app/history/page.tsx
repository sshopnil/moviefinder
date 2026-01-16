import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecentlyViewedAction } from "@/actions/history";
import { HistoryList } from "@/components/history-list";
import { History as HistoryIcon } from "lucide-react";

export default async function HistoryPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const historyItems = await getRecentlyViewedAction(100); // Fetch up to 100 items

    return (
        <main className="container mx-auto px-4 py-20 min-h-screen">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <HistoryIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">Watch History</h1>
                    <p className="text-gray-400 text-sm">Recently watched movies and TV episodes</p>
                </div>
            </div>

            <HistoryList initialItems={historyItems as any} />
        </main>
    );
}
