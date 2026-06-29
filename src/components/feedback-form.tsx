"use client";

import { submitFeedbackAction, type FeedbackState } from "@/actions/feedback";
import { Github, Loader2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-bold text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Feedback
        </button>
    );
}

export function FeedbackForm() {
    const [state, setState] = useState<FeedbackState>(null);
    const formRef = useRef<HTMLFormElement>(null);

    async function clientAction(formData: FormData) {
        const result = await submitFeedbackAction(null, formData);
        setState(result);

        if (result?.success) {
            formRef.current?.reset();
        }
    }

    return (
        <form ref={formRef} action={clientAction} className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
                <Github className="mt-0.5 h-4 w-4 shrink-0 text-gray-100" />
                <p>Your feedback will be opened as a GitHub issue immediately when server GitHub credentials are configured.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
                <div className="space-y-2">
                    <label className="text-sm text-gray-400" htmlFor="feedback-subject">Subject</label>
                    <input
                        id="feedback-subject"
                        name="subject"
                        type="text"
                        required
                        minLength={4}
                        maxLength={120}
                        placeholder="What should we improve?"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-gray-400" htmlFor="feedback-category">Type</label>
                    <select
                        id="feedback-category"
                        name="category"
                        defaultValue="feedback"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none [&>option]:bg-zinc-900"
                    >
                        <option value="feedback">Feedback</option>
                        <option value="bug">Bug</option>
                        <option value="feature">Feature</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm text-gray-400" htmlFor="feedback-message">Message</label>
                <textarea
                    id="feedback-message"
                    name="message"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                    placeholder="Share details, steps to reproduce, or what you expected."
                    className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-gray-500 focus:border-white/30 focus:outline-none"
                />
            </div>

            {state?.error && (
                <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-sm text-red-400">
                    {state.error}
                </div>
            )}
            {state?.success && (
                <div className="rounded border border-green-500/20 bg-green-500/10 p-2 text-sm text-green-400">
                    {state.success}{" "}
                    {state.issueUrl && (
                        <a href={state.issueUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                            View issue
                        </a>
                    )}
                </div>
            )}

            <SubmitButton />
        </form>
    );
}
