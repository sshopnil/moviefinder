"use client";

import { WatchProviders as WatchProvidersType, Provider, Season } from "@/types/movie";
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import Image from "next/image";
import { useState, useMemo } from "react";
import { Play, Server, Film, Tv } from "lucide-react";
import { PlayerModal } from "./player-modal";
import { logViewAction } from "@/actions/history";

interface Props {
    providers?: WatchProvidersType;
    tmdbId: number;
    mediaType: "movie" | "tv";
    seasons?: Season[];
    title?: string;
    poster_path?: string | null;
    initialSeason?: number;
    initialEpisode?: number;
}

type ServerType = "multiembed" | "vidsrcme" | "2embed";

const SERVERS: { id: ServerType; name: string; label: string }[] = [
    { id: "multiembed", name: "Standard", label: "Standard Server" },
    { id: "vidsrcme", name: "Backup 1", label: "Backup Server 1" },
    { id: "2embed", name: "Backup 2", label: "Backup Server 2" },
];

export function WatchProviders({ providers, tmdbId, mediaType, seasons, title, poster_path, initialSeason, initialEpisode }: Props) {
    const [showPlayer, setShowPlayer] = useState(false);
    const [selectedServer, setSelectedServer] = useState<ServerType>("multiembed");

    // TV State
    const [selectedSeason, setSelectedSeason] = useState(initialSeason || 1);
    const [selectedEpisode, setSelectedEpisode] = useState(initialEpisode || 1);

    // Filter out Season 0 (Specials) usually
    const validSeasons = useMemo(() =>
        seasons?.filter(s => s.season_number > 0) || [],
        [seasons]);

    const currentSeason = validSeasons.find(s => s.season_number === selectedSeason);
    const episodeCount = currentSeason?.episode_count || 1;
    const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);

    // Default to US or first available
    const countryCode = "US";
    const countryProviders = providers?.results?.[countryCode] ||
        (providers?.results ? Object.values(providers.results)[0] : undefined);

    const hasProviders = countryProviders && (
        (countryProviders.flatrate?.length ?? 0) > 0 ||
        (countryProviders.rent?.length ?? 0) > 0 ||
        (countryProviders.buy?.length ?? 0) > 0 ||
        (countryProviders.ads?.length ?? 0) > 0 ||
        (countryProviders.free?.length ?? 0) > 0
    );

    const getStreamUrl = () => {
        if (mediaType === "movie") {
            switch (selectedServer) {
                case "multiembed": return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
                case "vidsrcme": return `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
                case "2embed": return `https://www.2embed.cc/embed/${tmdbId}`;
                default: return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
            }
        } else {
            switch (selectedServer) {
                case "multiembed": return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${selectedSeason}&e=${selectedEpisode}`;
                case "vidsrcme": return `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${selectedSeason}&episode=${selectedEpisode}`;
                case "2embed": return `https://www.2embed.cc/embedtv/${tmdbId}&s=${selectedSeason}&e=${selectedEpisode}`;
                default: return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${selectedSeason}&e=${selectedEpisode}`;
            }
        }
    };

    return (
        <div className="space-y-6 bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        {mediaType === 'movie' ? <Film className="h-5 w-5 text-blue-400" /> : <Tv className="h-5 w-5 text-purple-400" />}
                        Stream Now
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-black/20 px-3 py-1 rounded-full">
                        <Server className="h-3 w-3" />
                        <span>Source: Free</span>
                    </div>
                </div>

                {/* Controls Area */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Server Selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-medium ml-1">Server</label>
                        <select
                            value={selectedServer}
                            onChange={(e) => setSelectedServer(e.target.value as ServerType)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                        >
                            {SERVERS.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* TV Controls */}
                    {mediaType === "tv" && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-xs text-gray-400 font-medium ml-1">Season</label>
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => {
                                        setSelectedSeason(Number(e.target.value));
                                        setSelectedEpisode(1); // Reset episode
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                                >
                                    {validSeasons.length > 0 ? (
                                        validSeasons.map(s => (
                                            <option key={s.id} value={s.season_number}>Season {s.season_number}</option>
                                        ))
                                    ) : (
                                        <option value={1}>Season 1</option>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs text-gray-400 font-medium ml-1">Episode</label>
                                <select
                                    value={selectedEpisode}
                                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                                >
                                    {episodes.map(num => (
                                        <option key={num} value={num}>Episode {num}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setShowPlayer(true);
                                if (title) {
                                    void logViewAction({
                                        id: tmdbId,
                                        type: mediaType,
                                        title: title,
                                        poster_path: poster_path || null,
                                        season: mediaType === 'tv' ? selectedSeason : undefined,
                                        episode: mediaType === 'tv' ? selectedEpisode : undefined,
                                        progress: 0,
                                        duration: 0
                                    });
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black px-6 py-2.5 rounded-lg font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/10"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            <span>Play {mediaType === 'tv' ? `S${selectedSeason}:E${selectedEpisode}` : 'Movie'}</span>
                        </button>
                    </div>
                </div>

                {hasProviders && (
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <p className="text-sm text-gray-400 font-medium">Also available on:</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-4">
                            {/* Simplified provider list to reduce clutter */}
                            {[
                                ...(countryProviders.flatrate || []),
                                ...(countryProviders.free || []),
                                ...(countryProviders.ads || [])
                            ].slice(0, 5).map(p => (
                                <ProviderLogo key={p.provider_id} provider={p} />
                            ))}
                            <a href={countryProviders.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline self-center">
                                + More on JustWatch
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {showPlayer && (
                <PlayerModal
                    url={getStreamUrl()}
                    onClose={() => setShowPlayer(false)}
                    tmdbId={tmdbId}
                    mediaType={mediaType}
                    title={title || ""}
                    poster_path={poster_path || null}
                    season={mediaType === "tv" ? selectedSeason : undefined}
                    episode={mediaType === "tv" ? selectedEpisode : undefined}
                />
            )}
        </div>
    );
}

function ProviderLogo({ provider }: { provider: Provider }) {
    return (
        <div className="flex items-center gap-2 group cursor-default">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-white/30 transition-all">
                <Image
                    src={TMDB_IMAGE_URL.logo(provider.logo_path)}
                    alt={provider.provider_name}
                    fill
                    className="object-cover"
                    sizes="32px"
                />
            </div>
            <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{provider.provider_name}</span>
        </div>
    )
}
