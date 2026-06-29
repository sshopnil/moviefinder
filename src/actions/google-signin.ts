"use server";

import { signIn } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function getSafeCallbackUrl(callbackUrl?: string | null) {
    if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
        return callbackUrl;
    }

    return "/";
}

export async function googleSignIn(formData: FormData) {
    const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl")?.toString());
    const redirectUrl = await signIn("google", { redirect: false, redirectTo: callbackUrl });

    if (!redirectUrl) {
        redirect("/login?error=Unable+to+start+Google+sign+in.");
    }

    const requestHeaders = await headers();
    const proto = requestHeaders.get("x-forwarded-proto") || "http";
    const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");

    if (!host) {
        redirect(redirectUrl);
    }

    const currentOrigin = `${proto}://${host}`;
    const url = new URL(redirectUrl);
    const googleRedirectUri = url.searchParams.get("redirect_uri");

    if (googleRedirectUri) {
        const redirectUri = new URL(googleRedirectUri);
        redirectUri.protocol = `${proto}:`;
        redirectUri.host = host;
        url.searchParams.set("redirect_uri", redirectUri.toString());
    } else if (url.origin === "http://localhost:3000" || url.origin === "https://localhost:3000") {
        url.protocol = `${proto}:`;
        url.host = host;
    }

    if (url.origin === "http://localhost:3000" || url.origin === "https://localhost:3000") {
        redirect(`${currentOrigin}${url.pathname}${url.search}${url.hash}`);
    }

    redirect(url.toString());
}
