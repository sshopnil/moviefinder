
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ label = "Back" }: { label?: string }) {
    const router = useRouter();

    return (
        <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-4 md:mb-8 mt-6 md:mt-10 group"
        >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}
