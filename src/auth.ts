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

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost: true,
    cookies: {
        sessionToken: {
            name: "moviefinder.session-token.v1",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    providers: [
        Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            authorization: {
                params: {
                    prompt: "select_account",
                },
            },
        }),
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsedCredentials = await z.object({
                    email: z.string().email(),
                    password: z.string().min(6),
                }).safeParseAsync(credentials);

                if (!parsedCredentials.success) {
                    return null;
                }

                const { password } = parsedCredentials.data;
                const email = parsedCredentials.data.email.toLowerCase();

                try {
                    await connectToDatabase();

                    const user = await User.findOne({ email });

                    if (!user?.password) {
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
                    throw error;
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
                try {
                    if (!user.email) {
                        return false;
                    }

                    await connectToDatabase();

                    const email = user.email.toLowerCase();
                    const existingUser = await User.findOne({ email });
                    if (!existingUser) {
                        await User.create({
                            name: user.name || email.split("@")[0],
                            email,
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
        async jwt({ token, user, account, trigger, session }) {
            if (trigger === "update" && session?.user) {
                if (session.user.name) token.name = session.user.name;
                if (session.user.email) token.email = session.user.email;
            }

            if (user) {
                // If this is a sign in
                if (account?.provider === "google") {
                    // Fetch the user from DB to get the _id if we want consistent IDs
                    // For now, simpler to just start with relaxed schema, but let's try to get the DB ID if possible
                    try {
                        await connectToDatabase();
                        const dbUser = user.email
                            ? await User.findOne({ email: user.email.toLowerCase() })
                            : null;

                        token.id = dbUser?._id.toString() ?? user.id;
                    } catch (error) {
                        console.error("Error loading Google user:", error);
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
                session.user.name = token.name ?? null;
                session.user.email = token.email ?? "";
            }
            return session;
        }
    }
});
