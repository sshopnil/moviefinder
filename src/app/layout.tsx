import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter for a clean modern look
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthHeader } from "@/components/auth-header";
import { WatchedProvider } from "@/components/watched-context";
import { getWatchedIdsAction } from "@/actions/watchlist";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MovieFinder AI",
  description: "Find your next favorite movie with AI",
  icons: {
    icon: "/logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const watchedIds = await getWatchedIdsAction();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-white/20`}>
        <Providers>
          <div className="fixed inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay z-50"></div>
          <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-blue-900/10 pointer-events-none -z-10"></div>
          <AuthHeader />
          <WatchedProvider initialWatchedIds={watchedIds}>
            {children}
          </WatchedProvider>
        </Providers>
      </body>
    </html>
  );
}
