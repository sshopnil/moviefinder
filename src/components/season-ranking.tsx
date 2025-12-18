"use client";

import { Trophy, TrendingUp, Users, Quote, Star } from "lucide-react";
import { motion } from "framer-motion";

interface Ranking {
    season_number: number;
    rank: number;
    score: number;
    verdict: string;
    reason: string;
    audience_reception: string;
    critics_consensus: string;
}

interface SeasonRankingProps {
    rankings: Ranking[];
    seasons: any[];
}

export function SeasonRanking({ rankings, seasons }: SeasonRankingProps) {
    if (!rankings || rankings.length === 0) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-white">Season Power Rankings</h3>
                    <p className="text-sm text-gray-400">Ranked by overall quality, critics, and viewer sentiment</p>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {rankings.map((ranking, index) => {
                    const season = seasons.find(s => s.season_number === ranking.season_number);
                    if (!season) return null;

                    return (
                        <div key={ranking.season_number} className="relative group">
                            {/* Ranking Number */}
                            <div className="absolute -left-3 top-4 z-10 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg text-sm">
                                #{ranking.rank}
                            </div>

                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white/5 border border-white/10 rounded-2xl p-6 pl-10 hover:bg-white/[0.07] transition-all flex flex-col md:flex-row gap-6 relative overflow-hidden"
                            >
                                {/* Score Indicator */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full flex items-center justify-center pointer-events-none">
                                    <div className="text-blue-400/20 font-black text-4xl">{ranking.score}</div>
                                </div>

                                {/* Title & Verdict */}
                                <div className="md:w-1/3 shrink-0">
                                    <h4 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                                        {season.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ranking.rank === 1 ? 'bg-yellow-500 text-black' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {ranking.verdict}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs text-blue-400 font-semibold">
                                            <Star className="h-3 w-3 fill-blue-400" />
                                            {ranking.score}/100
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-4 leading-relaxed line-clamp-3 italic">
                                        "{ranking.reason}"
                                    </p>
                                </div>

                                {/* Separator for desktop */}
                                <div className="hidden md:block w-px bg-white/10 self-stretch my-2" />

                                {/* Detailed Insights */}
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-purple-400">
                                            <Users className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Audience</span>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-snug">
                                            {ranking.audience_reception}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-green-400">
                                            <Quote className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Critics</span>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-snug">
                                            {ranking.critics_consensus}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Ornament Between Items */}
                            {index < rankings.length - 1 && (
                                <div className="flex justify-center my-1 pointer-events-none">
                                    <div className="w-px h-6 bg-gradient-to-b from-white/10 to-transparent" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
