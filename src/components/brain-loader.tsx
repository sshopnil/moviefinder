"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

export function BrainLoader({ variant = "fullscreen", message = "BRAIN IS BRAINING" }: { variant?: "fullscreen" | "section", message?: string }) {
    const isSection = variant === "section";

    return (
        <div
            className={`
                flex flex-col items-center justify-center 
                ${isSection
                    ? "absolute inset-0 z-10 bg-black/60 backdrop-blur-sm rounded-xl"
                    : "fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
                }
            `}
        >
            {/* Ambient Background Glow */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className={`absolute bg-purple-600/20 rounded-full blur-[100px] ${isSection ? "w-48 h-48" : "w-96 h-96"}`}
            />

            <div className={`relative ${isSection ? "scale-75" : ""}`}>
                {/* Orbiting Particles */}
                {[...Array(3)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full border border-purple-500/30"
                        style={{ width: "120%", height: "120%", left: "-10%", top: "-10%" }}
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 8 - i * 2,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i,
                        }}
                    >
                        <div className="w-2 h-2 bg-purple-400 rounded-full absolute -top-1 left-1/2 -translate-x-1/2 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                    </motion.div>
                ))}

                {/* Central Brain Icon */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        filter: [
                            "drop-shadow(0 0 20px rgba(168,85,247,0.4))",
                            "drop-shadow(0 0 40px rgba(168,85,247,0.8))",
                            "drop-shadow(0 0 20px rgba(168,85,247,0.4))",
                        ],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <Brain className={`${isSection ? "w-16 h-16" : "w-24 h-24"} text-white`} strokeWidth={1.5} />
                </motion.div>
            </div>

            {/* Text Animation */}
            <motion.div
                className={`flex items-center gap-1 ${isSection ? "mt-8" : "mt-12"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <span className={`${isSection ? "text-lg" : "text-2xl"} font-light text-white tracking-widest uppercase`}>
                    {message}
                </span>
                <span className="flex gap-1 ml-1">
                    {[0, 1, 2].map((i) => (
                        <motion.span
                            key={i}
                            className="w-1.5 h-1.5 bg-purple-400 rounded-full"
                            animate={{
                                y: [0, -6, 0],
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </span>
            </motion.div>

            <motion.p
                className={`text-white/40 font-mono ${isSection ? "mt-2 text-xs" : "mt-4 text-sm"}`}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                Simulating neural pathways...
            </motion.p>
        </div>
    );
}
