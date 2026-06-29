import { X, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [volume, setVolume] = useState(100);
    const [showVolume, setShowVolume] = useState(false);
    const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);

        const handleMessage = (e: MessageEvent) => {
            if (!e.origin || !e.data) return;

            // Vidsrc specific message format
            try {
                const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
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
            } catch {
                // Ignore parse errors from other sources
            }
        };

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("keydown", handleEsc);
            window.removeEventListener("message", handleMessage);
        };
    }, [onClose, tmdbId, mediaType, title, poster_path, season, episode]);

    const handleVolumeChange = (delta: number) => {
        const newVolume = Math.min(100, Math.max(0, volume + delta));
        setVolume(newVolume);
        setShowVolume(true);

        // Clear existing timeout
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);

        // Hide after 2 seconds
        volumeTimeoutRef.current = setTimeout(() => {
            setShowVolume(false);
        }, 2000);

        // Try to send volume command to iframe (best effort)
        if (iframeRef.current?.contentWindow) {
            // Try common formats
            const formats = [
                { event: 'command', func: 'setVolume', args: [newVolume] },
                { event: 'command', func: 'setVolume', args: [newVolume / 100] },
                { type: 'setVolume', data: newVolume },
                { type: 'setVolume', value: newVolume }
            ];

            formats.forEach(msg => {
                iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
            });
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Only handle vertical scroll
        if (Math.abs(e.deltaY) > 0) {
            // Scroll up (negative delta) increases volume
            const direction = e.deltaY < 0 ? 1 : -1;
            handleVolumeChange(direction * 5);
        }
    };

    if (!url) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
            onWheel={handleWheel}
        >
            <div className="relative w-full h-full sm:max-w-6xl sm:h-auto sm:aspect-video bg-black sm:rounded-xl overflow-hidden shadow-2xl flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/20 rounded-full text-white transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* Volume Overlay */}
                <div
                    className={`absolute inset-0 z-20 pointer-events-none flex items-center justify-center transition-opacity duration-300 ${showVolume ? 'opacity-100' : 'opacity-0'}`}
                >
                    <div className="bg-black/60 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center gap-4 text-white min-w-[120px]">
                        {volume === 0 ? (
                            <VolumeX className="w-12 h-12 text-white/80" />
                        ) : (
                            <Volume2 className="w-12 h-12 text-white/80" />
                        )}
                        <span className="text-2xl font-bold">{volume}%</span>
                        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-100"
                                style={{ width: `${volume}%` }}
                            />
                        </div>
                    </div>
                </div>

                <iframe
                    key={url}
                    ref={iframeRef}
                    src={url}
                    title="Media Player"
                    className="w-full h-full flex-1 border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
                    referrerPolicy="no-referrer"
                    allowFullScreen
                />
            </div>
            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>,
        document.body
    );
}
