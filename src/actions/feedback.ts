"use server";

import { auth } from "@/auth";
import { z } from "zod";

const FeedbackSchema = z.object({
    subject: z.string().trim().min(4, "Subject must be at least 4 characters").max(120, "Subject is too long"),
    category: z.enum(["feedback", "bug", "feature"]),
    message: z.string().trim().min(10, "Feedback must be at least 10 characters").max(4000, "Feedback is too long"),
});

export type FeedbackState = {
    error?: string;
    success?: string;
    issueUrl?: string;
} | null;

function getGithubRepo() {
    return process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || "sshopnil/moviefinder";
}

export async function submitFeedbackAction(_prevState: FeedbackState, formData: FormData): Promise<FeedbackState> {
    const session = await auth();

    if (!session?.user) {
        return { error: "You must be signed in to send feedback." };
    }

    const parsed = FeedbackSchema.safeParse({
        subject: formData.get("subject"),
        category: formData.get("category"),
        message: formData.get("message"),
    });

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message || "Invalid feedback" };
    }

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const repo = getGithubRepo();

    if (!token) {
        return { error: "Feedback is configured, but GITHUB_TOKEN or GH_TOKEN is missing on the server." };
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: "POST",
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
                title: `[${parsed.data.category}] ${parsed.data.subject}`,
                body: [
                    parsed.data.message,
                    "",
                    "---",
                    `Submitted by: ${session.user.name || "Unknown"} <${session.user.email || "no-email"}>`,
                    `User ID: ${session.user.id || "unknown"}`,
                ].join("\n"),
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("GitHub feedback issue creation failed:", data);
            return { error: data?.message || "Could not create GitHub issue." };
        }

        return {
            success: "Feedback sent and GitHub issue created.",
            issueUrl: data.html_url,
        };
    } catch (error) {
        console.error("Feedback submission error:", error);
        return { error: "Could not send feedback right now." };
    }
}
