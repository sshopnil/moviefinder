'use client';

import { useFormStatus } from "react-dom";
import { resetPassword } from "@/actions/user";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { useSearchParams, useRouter } from "next/navigation";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Reset Password
        </button>
    );
}

// Separate component for the form content to use hooks properly
function ResetPasswordFormContent() {
    const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    const userId = searchParams.get("userId");
    const token = searchParams.get("token");

    if (!userId || !token) {
        return (
            <div className="text-center space-y-4">
                <div className="text-red-400 bg-red-500/10 p-4 rounded border border-red-500/20">
                    Invalid or missing reset token. Please request a new link.
                </div>
                <Link href="/forgot-password" className="text-white hover:underline">
                    Go to Forgot Password
                </Link>
            </div>
        );
    }

    async function clientAction(formData: FormData) {
        const result = await resetPassword(null, formData);
        setState(result as any);
        if (result?.success) {
            // Redirect to login after success (optional delay)
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        }
    }

    return (
        <form action={clientAction} className="space-y-6">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="token" value={token} />

            <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-200">
                    New Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="Of at least 6 characters"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-200">
                    Confirm Password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="Re-enter password"
                />
            </div>

            {state?.error && (
                <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded border border-red-500/20">
                    {state.error}
                </div>
            )}

            {state?.success && (
                <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded border border-green-500/20">
                    {state.success}
                </div>
            )}

            <SubmitButton />
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md space-y-8 p-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold text-white">Reset Password</h1>
                    <p className="text-gray-400">Enter your new password below</p>
                </div>

                {/* Suspense boundary might be needed for useSearchParams in some Next.js versions/builds, 
                     but client component strictly usually handles it. 
                     However, wrapping in Suspense is safer for static generation friendliness. 
                 */}
                <ResetPasswordFormContent />

                <div className="text-center">
                    <Link href="/login" className="text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 transition-colors">
                        <ArrowLeft size={16} />
                        Back to Login
                    </Link>
                </div>
            </GlassCard>
        </main>
    );
}
