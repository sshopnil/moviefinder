'use client';

import { useFormStatus } from "react-dom";
import { forgotPassword } from "@/actions/user";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Reset Link
        </button>
    );
}

export default function ForgotPasswordPage() {
    const [state, setState] = useState<{ error?: string; success?: string } | null>(null);

    async function clientAction(formData: FormData) {
        const result = await forgotPassword(null, formData);
        setState(result as any);
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md space-y-8 p-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold text-white">Forgot Password</h1>
                    <p className="text-gray-400">Enter your email to receive a reset link</p>
                </div>

                <form action={clientAction} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-gray-200">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors"
                            placeholder="name@example.com"
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
