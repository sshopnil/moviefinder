import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"]
    }
}

import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                await connectToDatabase();

                try {
                    const { email, password } = await z.object({
                        email: z.string().email(),
                        password: z.string().min(6),
                    }).parseAsync(credentials);

                    const user = await User.findOne({ email });

                    if (!user) {
                        return null;
                    }

                    const isPasswordValid = await bcrypt.compare(password, user.password);

                    if (!isPasswordValid) {
                        return null;
                    }

                    return {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                    };

                } catch (error) {
                    console.error("Auth Error:", error);
                    return null;
                }
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                await connectToDatabase();
                try {
                    const existingUser = await User.findOne({ email: user.email });
                    if (!existingUser) {
                        await User.create({
                            name: user.name,
                            email: user.email,
                            image: user.image,
                            // No password for OAuth users
                        });
                    }
                    return true;
                } catch (error) {
                    console.error("Error creating user:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, account }) {
            if (user) {
                // If this is a sign in
                if (account?.provider === "google") {
                    // Fetch the user from DB to get the _id if we want consistent IDs
                    // For now, simpler to just start with relaxed schema, but let's try to get the DB ID if possible
                    await connectToDatabase();
                    const dbUser = await User.findOne({ email: user.email });
                    if (dbUser) {
                        token.id = dbUser._id.toString();
                    } else {
                        token.id = user.id; // Fallback
                    }
                } else {
                    token.id = user.id;
                }
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        }
    }
});
