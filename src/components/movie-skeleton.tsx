"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function MovieSkeleton() {
    return (
        <div className="container mx-auto px-4 py-8 animate-in fade-in duration-500">
            <div className="grid md:grid-cols-[300px_1fr] gap-8">
                {/* Poster Skeleton */}
                <div className="aspect-[2/3] w-full max-w-[300px] mx-auto md:mx-0">
                    <Skeleton className="w-full h-full rounded-xl bg-white/5" />
                </div>

                {/* Content Skeleton */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-3/4 bg-white/10" />
                        <Skeleton className="h-6 w-1/2 bg-white/5" />
                    </div>

                    <div className="flex gap-4">
                        <Skeleton className="h-10 w-24 rounded-full bg-white/5" />
                        <Skeleton className="h-10 w-24 rounded-full bg-white/5" />
                    </div>

                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-20 rounded-full bg-white/5" />
                        <Skeleton className="h-8 w-20 rounded-full bg-white/5" />
                        <Skeleton className="h-8 w-20 rounded-full bg-white/5" />
                    </div>

                    <div className="space-y-4">
                        <Skeleton className="h-6 w-32 bg-white/10" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full bg-white/5" />
                            <Skeleton className="h-4 w-full bg-white/5" />
                            <Skeleton className="h-4 w-2/3 bg-white/5" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Skeleton className="h-6 w-32 bg-white/10" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="aspect-square rounded-full w-20 mx-auto bg-white/5" />
                                    <Skeleton className="h-4 w-16 mx-auto bg-white/5" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
