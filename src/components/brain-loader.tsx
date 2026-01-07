"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

export function BrainLoader() {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
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
                className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"
            />

            <div className="relative">
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
                    <Brain className="w-24 h-24 text-white" strokeWidth={1.5} />
                </motion.div>
            </div>

            {/* Text Animation */}
            <motion.div
                className="mt-12 flex items-center gap-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <span className="text-2xl font-light text-white tracking-widest">
                    BRAIN IS BRAINING
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
                className="mt-4 text-white/40 text-sm font-mono"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
            >
                Simulating neural pathways...
            </motion.p>
        </div>
    );
}
