'use server';

import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";

const ChangePasswordSchema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function updateUserPassword(prevState: any, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { error: "Not authenticated" };
        }

        const currentPassword = formData.get("currentPassword") as string;
        const newPassword = formData.get("newPassword") as string;

        const validatedFields = ChangePasswordSchema.safeParse({
            currentPassword,
            newPassword,
        });

        if (!validatedFields.success) {
            return { error: validatedFields.error.flatten().fieldErrors.newPassword?.[0] || "Invalid input" };
        }

        await connectToDatabase();
        const user = await User.findOne({ email: session.user.email });

        if (!user) {
            return { error: "User not found" };
        }

        // If user has a password, verify current password
        if (user.password) {
            if (!currentPassword) {
                return { error: "Current password is required" };
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return { error: "Incorrect current password" };
            }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        revalidatePath("/dashboard");
        return { success: "Password updated successfully" };

    } catch (error) {
        console.error("Error updating password:", error);
        return { error: "Failed to update password" };
    }
}

export async function forgotPassword(prevState: any, formData: FormData) {
    try {
        const email = formData.get("email") as string;

        if (!email) {
            return { error: "Email is required" };
        }

        await connectToDatabase();
        const user = await User.findOne({ email });

        if (!user) {
            // For security, do not reveal if user exists
            return { success: "If an account exists, a reset link has been sent." };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString("hex");
        const resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        const resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

        user.resetPasswordToken = resetPasswordToken;
        user.resetPasswordExpire = resetPasswordExpire;
        await user.save();

        // MOCK EMAIL SENDING
        const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?userId=${user._id}&token=${resetToken}`;
        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

        console.log("------------------------------------------");
        console.log("MOCK EMAIL SENT TO:", email);
        console.log("RESET LINK:", resetUrl);
        console.log("------------------------------------------");

        return { success: "If an account exists, a reset link has been sent." };

    } catch (error) {
        console.error("Forgot Password Error:", error);
        return { error: "Could not send reset email" };
    }
}

const ResetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export async function resetPassword(prevState: any, formData: FormData) {
    try {
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;
        const userId = formData.get("userId") as string;
        const token = formData.get("token") as string;

        const validatedFields = ResetPasswordSchema.safeParse({ password, confirmPassword });

        if (!validatedFields.success) {
            return { error: validatedFields.error.flatten().fieldErrors.confirmPassword?.[0] || "Invalid input" };
        }

        if (!token || !userId) {
            return { error: "Invalid token or user" };
        }

        const resetPasswordToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        await connectToDatabase();
        const user = await User.findOne({
            _id: userId,
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return { error: "Invalid token" };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        return { success: "Password reset successful! You can now login." };

    } catch (error) {
        console.error("Reset Password Error:", error);
        return { error: "Failed to reset password" };
    }
}
