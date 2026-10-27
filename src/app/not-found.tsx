import Link from "next/link";
import { Film, Home } from "lucide-react";

export default function NotFound() {
    return (
        <main className="container mx-auto px-4 py-24 min-h-[80vh] flex items-center justify-center">
            <div className="max-w-md w-full rounded-2xl bg-white/5 border border-white/10 p-8 text-center space-y-6 backdrop-blur-md">
                <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Film className="h-7 w-7 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-white">404 — Not Found</h1>
                    <p className="text-sm text-gray-400">
                        The movie, TV series, or page you&apos;re looking for doesn&apos;t exist or may have been moved.
                    </p>
                </div>
                <div className="flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                    >
                        <Home className="h-4 w-4" />
                        Explore Movies &amp; TV
                    </Link>
                </div>
            </div>
        </main>
    );
}

