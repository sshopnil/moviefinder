"use server";

import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignupState = {
    error?: {
        form?: string[];
        name?: string[];
        email?: string[];
        password?: string[];
    } | null;
};

function isDatabaseConnectionError(error: unknown) {
    return error instanceof Error && (
        error.name === "MongooseServerSelectionError" ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("Server selection timed out")
    );
}

export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
    const validatedFields = signupSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { password } = validatedFields.data;
    const name = validatedFields.data.name.trim();
    const email = validatedFields.data.email.toLowerCase();

    try {
        await connectToDatabase();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return {
                error: { email: ["Email already in use"] },
            };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email,
            password: hashedPassword,
        });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return {
                error: { email: ["Email already in use"] },
            };
        }

        if (isDatabaseConnectionError(error)) {
            console.error("Signup database connection error:", error);
            return {
                error: { form: ["Database is unavailable. Check MONGODB_URI and try again."] },
            };
        }

        console.error("Signup Error:", error);
        return {
            error: { form: ["Could not create account. Please try again."] },
        };
    }

    const params = new URLSearchParams({ success: "Account created. Please log in." });
    redirect(`/login?${params.toString()}`);
}
