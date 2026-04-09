import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RefreshButton } from "@/components/RefreshButton";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bandcamp Feed",
  description: "Releases from artists you follow on Bandcamp",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              bandcamp feed
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-400">
              <Link href="/releases" className="hover:text-white">Releases</Link>
              <Link href="/artists" className="hover:text-white">Artists</Link>
            </nav>
            <div className="ml-auto">
              <RefreshButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-6 py-8 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
