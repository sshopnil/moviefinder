import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter for a clean modern look
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MovieFinder AI",
  description: "Find your next favorite movie with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-white/20`}>
        <div className="fixed inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay z-50"></div>
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-blue-900/10 pointer-events-none -z-10"></div>
        {children}
      </body>
    </html>
  );
}
