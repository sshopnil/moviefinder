'use client';

import { useState } from "react";
// import { updateUserPassword } from "@/actions/user"; // We will implement this
import { updateUserPassword } from "@/actions/user";
import { useFormStatus } from "react-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-white text-black font-bold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
        </button>
    );
}

export function UserPasswordForm({ userEmail }: { userEmail: string }) {
    const [state, setState] = useState<{ error?: string; success?: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // We'll use a wrapper to handle the server action response
    async function clientAction(formData: FormData) {
        const result = await updateUserPassword(null, formData);
        setState(result as any);
        if (result?.success) {
            // Optional: Reset form or show explicit success state that persists
            (document.getElementById("passwordAPI") as HTMLFormElement)?.reset();
        }
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm text-gray-400">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        value="****************" // Fake masked password
                        readOnly
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 cursor-not-allowed text-gray-400"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                <p className="text-xs text-gray-500">
                    {showPassword ? "This is a placeholder. Your actual password is encrypted." : "Password is hidden."}
                </p>
            </div>

            <div className="pt-4 border-t border-white/10">
                <h3 className="text-lg font-medium text-white mb-4">Change Password</h3>
                <form action={clientAction} id="passwordAPI" className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">Current Password (leave blank if not set)</label>
                        <input
                            name="currentPassword"
                            type="password"
                            placeholder="Current Password"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">New Password</label>
                        <input
                            name="newPassword"
                            type="password"
                            placeholder="New Password"
                            required
                            minLength={6}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30"
                        />
                    </div>

                    {state?.error && (
                        <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
                            {state.error}
                        </div>
                    )}
                    {state?.success && (
                        <div className="text-green-400 text-sm bg-green-500/10 p-2 rounded border border-green-500/20">
                            {state.success}
                        </div>
                    )}

                    <SubmitButton />
                </form>
            </div>
        </div>
    );
}
