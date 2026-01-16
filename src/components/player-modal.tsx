import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { logViewAction } from "@/actions/history";

interface PlayerModalProps {
    url: string;
    onClose: () => void;
    // Metadata for progress tracking
    tmdbId: number;
    mediaType: "movie" | "tv";
    title: string;
    poster_path: string | null;
    season?: number;
    episode?: number;
}

export function PlayerModal({ url, onClose, tmdbId, mediaType, title, poster_path, season, episode }: PlayerModalProps) {
    // ref to track last update to avoid spamming
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);

        const handleMessage = (e: MessageEvent) => {
            if (!e.origin || !e.data) return;

            // Vidsrc specific message format
            // Based on research: standard HTML5 video events might be proxied or custom format.
            // Often: { event: 'time', data: { time: 123, duration: 456 } } or similar.
            // Let's log to see what we get first? No, we need to implement best guess.
            // Common embed player pattern:
            try {
                const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

                // VidSrc often sends: { type: "timeupdate", data: { currentTime: 10, duration: 100 } }
                // or just { currentTime: 10, duration: 100 }

                const currentTime = data?.data?.currentTime || data?.currentTime || data?.time;
                const duration = data?.data?.duration || data?.duration;

                if (typeof currentTime === 'number' && typeof duration === 'number' && duration > 0) {
                    const now = Date.now();
                    // Update every 15 seconds
                    if (now - lastUpdateRef.current > 15000) {
                        lastUpdateRef.current = now;
                        // Log progress (minutes)
                        logViewAction({
                            id: tmdbId,
                            type: mediaType,
                            title: title,
                            poster_path: poster_path,
                            season,
                            episode,
                            progress: Math.floor(currentTime / 60),
                            duration: Math.floor(duration / 60)
                        });
                    }
                }
            } catch (err) {
                // Ignore parse errors from other sources
            }
        };

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("keydown", handleEsc);
            window.removeEventListener("message", handleMessage);
        };
    }, [onClose, tmdbId, mediaType, title, poster_path, season, episode]);

    if (!url) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="relative w-full h-full sm:max-w-6xl sm:h-auto sm:aspect-video bg-black sm:rounded-xl overflow-hidden shadow-2xl flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>
                <iframe
                    src={url}
                    title="Media Player"
                    className="w-full h-full flex-1 border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>,
        document.body
    );
}
