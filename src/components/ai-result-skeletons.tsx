import { Skeleton } from "@/components/ui/skeleton";

export function AIRecommendationCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <Skeleton className="aspect-video w-full rounded-none bg-white/10" />
            <div className="space-y-4 p-4">
                <Skeleton className="h-3 w-36 bg-white/10" />
                <Skeleton className="h-4 w-full bg-white/10" />
                <Skeleton className="h-4 w-4/5 bg-white/5" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-20 bg-white/5" />
                    <Skeleton className="h-20 bg-white/5" />
                </div>
                <Skeleton className="h-16 bg-blue-500/10" />
            </div>
        </div>
    );
}

export function AIVerdictSkeleton() {
    return (
        <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 to-purple-950/20 p-6">
            <div className="space-y-4">
                <Skeleton className="h-4 w-28 bg-indigo-400/20" />
                <Skeleton className="h-9 w-2/5 bg-white/10" />
                <Skeleton className="h-5 w-4/5 bg-white/10" />
                <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-3">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="space-y-2">
                            <Skeleton className="h-3 w-20 bg-white/10" />
                            <Skeleton className="h-4 w-full bg-white/5" />
                            <Skeleton className="h-4 w-3/4 bg-white/5" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SeasonRankingItemSkeleton() {
    return (
        <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 md:grid-cols-3">
            <div className="space-y-3">
                <Skeleton className="h-6 w-36 bg-white/10" />
                <Skeleton className="h-4 w-24 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-3 w-20 bg-white/10" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-4/5 bg-white/5" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-3 w-20 bg-white/10" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
            </div>
        </div>
    );
}

export function SeasonRankingSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-7 w-64 bg-white/10" />
                <Skeleton className="h-4 w-96 max-w-full bg-white/5" />
            </div>
            {Array.from({ length: count }, (_, item) => (
                <SeasonRankingItemSkeleton key={item} />
            ))}
        </div>
    );
}

export function ReviewsSectionSkeleton() {
    return (
        <div className="space-y-8 py-4">
            <Skeleton className="h-8 w-64 bg-white/10" />
            <AIVerdictSkeleton />
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-wrap justify-between gap-6">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-36 bg-white/10" />
                        <Skeleton className="h-4 w-52 bg-white/5" />
                    </div>
                    <div className="flex gap-4">
                        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-20 bg-white/5" />)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MediaCardGridSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-6 py-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64 bg-white/10" />
                <Skeleton className="h-4 w-80 max-w-full bg-white/5" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: count }, (_, item) => (
                    <Skeleton key={item} className="aspect-[2/3] rounded-xl bg-white/5" />
                ))}
            </div>
        </div>
    );
}

export function AIRecommendationSectionSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="space-y-6 py-6">
            <Skeleton className="h-8 w-52 bg-white/10" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: count }, (_, item) => <AIRecommendationCardSkeleton key={item} />)}
            </div>
        </div>
    );
}

export function SearchResultsPageSkeleton() {
    return (
        <main className="container mx-auto min-h-screen space-y-8 px-4 py-8">
            <div className="mx-auto max-w-2xl space-y-8">
                <Skeleton className="h-12 w-full rounded-full bg-white/10" />
                <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
            </div>
            <Skeleton className="h-10 w-28 bg-white/5" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, item) => <AIRecommendationCardSkeleton key={item} />)}
            </div>
        </main>
    );
}
