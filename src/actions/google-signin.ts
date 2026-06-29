"use server";

import { signIn } from "@/auth";

function getSafeCallbackUrl(callbackUrl?: string | null) {
    if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
        return callbackUrl;
    }

    return "/";
}

export async function googleSignIn(formData: FormData) {
    const callbackUrl = getSafeCallbackUrl(formData.get("callbackUrl")?.toString());
    await signIn("google", { redirectTo: callbackUrl });
}
