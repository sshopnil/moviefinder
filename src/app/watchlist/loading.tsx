import { Skeleton } from "@/components/ui/skeleton";

export default function WatchlistLoading() {
    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col gap-4">
                <Skeleton className="h-10 w-48 bg-white/10" />
                <Skeleton className="h-6 w-96 bg-white/5" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton className="aspect-[2/3] rounded-xl bg-white/5" />
                        <Skeleton className="h-4 w-3/4 bg-white/5" />
                    </div>
                ))}
            </div>
        </div>
    );
}
