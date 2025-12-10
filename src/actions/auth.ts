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

export async function signupAction(prevState: any, formData: FormData) {
    const validatedFields = signupSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name, email, password } = validatedFields.data;

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

    redirect("/login?success=Account created! Please log in.");
}
