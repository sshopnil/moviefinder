import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { googleSignIn } from "@/actions/google-signin";

// Simple login form using server action wrapper for signIn
async function login(formData: FormData) {
    "use server";
    try {
        await signIn("credentials", Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes("CredentialsSignin")) {
            // Returning string to client component form action... requires useFormState but here we kept it simple.
            // In a real app we'd redirect to error page or use useFormState.
            // For now, let's just let it be.
            const err = "Invalid credentials";
        }
        throw error; // Rethrow to let NextAuth handle redirect
    }
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md p-8 space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Welcome Back
                    </h1>
                    <p className="text-gray-400">Log in to your account</p>
                </div>

                <form action={login as any} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Log In
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-sm text-gray-400 mb-4">or</p>
                    <form action={googleSignIn}>
                        <button type="submit" className="w-full bg-white/10 text-white font-medium py-3 rounded-xl border border-white/20 hover:bg-white/20 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm">
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Sign in with Google
                        </button>
                    </form>
                </div>

                <div className="text-center text-sm text-gray-400 mt-4">
                    Don't have an account?{" "}
                    <Link href="/signup" className="text-white hover:underline">
                        Sign up
                    </Link>
                </div>
            </GlassCard>
        </div>
    );
}
