"use client";

import Image from "next/image";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface MediaGalleryProps {
    images: {
        backdrops: { file_path: string }[];
        posters: { file_path: string }[];
    };
}

interface LightboxProps {
    images: { file_path: string; type: string }[];
    initialIndex: number;
    onClose: () => void;
}

function LightboxCarousel({ images, initialIndex, onClose }: LightboxProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        startIndex: initialIndex,
        loop: true,
        align: "center",
        containScroll: false
    });

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") scrollPrev();
            if (e.key === "ArrowRight") scrollNext();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [scrollPrev, scrollNext, onClose]);

    return (
        <div className="relative w-full h-[80vh] group/lightbox">
            <div className="overflow-hidden h-full" ref={emblaRef}>
                <div className="flex h-full touch-pan-y">
                    {images.map((image, index) => (
                        <div
                            key={`${image.file_path}-${index}-lightbox`}
                            className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-4"
                        >
                            <div className="relative w-full h-full max-w-5xl mx-auto">
                                <Image
                                    src={TMDB_IMAGE_URL.backdrop(image.file_path) || TMDB_IMAGE_URL.poster(image.file_path)}
                                    alt="Full size"
                                    fill
                                    className="object-contain drop-shadow-2xl"
                                    priority={index === initialIndex}
                                    quality={100}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button
                onClick={scrollPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover/lightbox:opacity-100 disabled:opacity-30"
                aria-label="Previous image"
            >
                <ChevronLeft className="h-6 w-6" />
            </button>
            <button
                onClick={scrollNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover/lightbox:opacity-100 disabled:opacity-30"
                aria-label="Next image"
            >
                <ChevronRight className="h-6 w-6" />
            </button>
        </div>
    );
}

export function MediaGallery({ images }: MediaGalleryProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: "start",
        dragFree: true,
        containScroll: "trimSnaps",
        loop: false
    });

    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setCanScrollPrev(emblaApi.canScrollPrev());
        setCanScrollNext(emblaApi.canScrollNext());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on("select", onSelect);
        emblaApi.on("reInit", onSelect);
    }, [emblaApi, onSelect]);

    const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
    const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

    const gallery = [
        ...images.backdrops.slice(0, 10).map(img => ({ ...img, type: 'backdrop' })),
        ...images.posters.slice(0, 5).map(img => ({ ...img, type: 'poster' }))
    ];

    if (gallery.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Media Gallery</h3>
                <div className="flex gap-2">
                    <button
                        onClick={scrollPrev}
                        disabled={!canScrollPrev}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="h-4 w-4 text-white" />
                    </button>
                    <button
                        onClick={scrollNext}
                        disabled={!canScrollNext}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="h-4 w-4 text-white" />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20" ref={emblaRef}>
                <div className="flex touch-pan-y -ml-4 cursor-grab active:cursor-grabbing">
                    {gallery.map((image, index) => (
                        <div
                            key={`${image.file_path}-${index}`}
                            className="flex-[0_0_50%] md:flex-[0_0_33.33%] lg:flex-[0_0_25%] min-w-0 pl-4"
                            onClick={() => setSelectedIndex(index)}
                        >
                            <div className="relative cursor-pointer w-full aspect-video group overflow-hidden rounded-lg bg-black/40">
                                <Image
                                    src={image.type === 'backdrop' ? TMDB_IMAGE_URL.backdrop(image.file_path) : TMDB_IMAGE_URL.poster(image.file_path)}
                                    alt="Gallery Image"
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="text-white w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
                <DialogContent className="max-w-[95vw] md:max-w-[90vw] h-[90vh] bg-transparent border-none p-0 shadow-none flex items-center justify-center">
                    <DialogTitle className="sr-only">Image Gallery</DialogTitle>
                    {selectedIndex !== null && (
                        <LightboxCarousel
                            images={gallery}
                            initialIndex={selectedIndex}
                            onClose={() => setSelectedIndex(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
