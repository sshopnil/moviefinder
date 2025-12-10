
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({ label = "Back" }: { label?: string }) {
    const router = useRouter();

    return (
        <button
            onClick={() => router.back()}
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8 mt-10"
        >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {label}
        </button>
    );
}
