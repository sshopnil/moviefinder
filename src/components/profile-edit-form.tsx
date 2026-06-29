"use client";

import { updateUserProfile, type UpdateProfileState } from "@/actions/user";
import { Loader2, Save } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-bold text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
        </button>
    );
}

export function ProfileEditForm({ name, email }: { name: string; email: string }) {
    const { update } = useSession();
    const [state, setState] = useState<UpdateProfileState>(null);

    async function clientAction(formData: FormData) {
        const result = await updateUserProfile(null, formData);
        setState(result);

        if (result?.user) {
            await update({ user: result.user });
        }
    }

    return (
        <form action={clientAction} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm text-gray-400" htmlFor="profile-name">Name</label>
                <input
                    id="profile-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    defaultValue={name}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm text-gray-400" htmlFor="profile-email">Email</label>
                <input
                    id="profile-email"
                    name="email"
                    type="email"
                    required
                    defaultValue={email}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                />
            </div>

            {state?.error && (
                <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-sm text-red-400">
                    {state.error}
                </div>
            )}
            {state?.success && (
                <div className="rounded border border-green-500/20 bg-green-500/10 p-2 text-sm text-green-400">
                    {state.success}
                </div>
            )}

            <SubmitButton />
        </form>
    );
}
