"use client";

import { Loader2 } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface LoginFormProps {
    callbackUrl: string;
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
    const router = useRouter();
    const { update } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(formData: FormData) {
        setError(null);

        startTransition(async () => {
            const result = await signIn("credentials", {
                email: formData.get("email")?.toString() || "",
                password: formData.get("password")?.toString() || "",
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid email or password.");
                return;
            }

            await update();
            router.refresh();
            router.replace(callbackUrl);
        });
    }

    return (
        <form action={handleSubmit} className="space-y-4">
            {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </p>
            )}

            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <input
                    name="email"
                    type="email"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="john@example.com"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <input
                    name="password"
                    type="password"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="••••••••"
                />
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Log In
            </button>
        </form>
    );
}
