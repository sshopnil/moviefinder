"use client";

import { SessionProvider } from "next-auth/react";
import { AIRateLimitToast } from "@/components/ai-rate-limit-toast";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            {children}
            <AIRateLimitToast />
        </SessionProvider>
    );
}
