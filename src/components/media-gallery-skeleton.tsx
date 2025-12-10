import { Skeleton } from "@/components/ui/skeleton";

export function MediaGallerySkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-32 bg-white/5" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-full bg-white/5" />
                    <Skeleton className="h-8 w-8 rounded-full bg-white/5" />
                </div>
            </div>
            <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="flex-[0_0_50%] md:flex-[0_0_33.33%] lg:flex-[0_0_25%] aspect-video rounded-xl bg-white/5" />
                ))}
            </div>
        </div>
    );
}
