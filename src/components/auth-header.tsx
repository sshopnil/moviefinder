
"use client";

import { useSession } from "next-auth/react";
import { SiteHeader } from "./site-header";

export function AuthHeader() {
    const { data: session } = useSession();

    return <SiteHeader user={session?.user} />;
}
