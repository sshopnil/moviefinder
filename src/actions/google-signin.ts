"use server";

import { signIn } from "@/auth";

export async function googleSignIn(formData: FormData) {
    const callbackUrl = formData.get("callbackUrl")?.toString() || "/";
    await signIn("google", { redirectTo: callbackUrl });
}
