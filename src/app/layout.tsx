import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RefreshButton } from "@/components/RefreshButton";
import { QueryProvider } from "@/components/QueryProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "bc sync",
  description: "Releases from artists you follow on Bandcamp",
  icons: {
    icon: "/assets/logos/bc-sync-logo.svg",
  },
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
        <QueryProvider>
          <header className="border-b border-neutral-800">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <Image src="/assets/logos/bc-sync-logo.svg" alt="bc sync logo" width={24} height={24} />
                bc sync
              </Link>
              <nav className="flex gap-4 text-sm text-neutral-400">
                <Link href="/releases" className="hover:text-white">Releases</Link>
                <Link href="/artists" className="hover:text-white">Artists</Link>
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <RefreshButton />
                <Link
                  href="/settings"
                  className="opacity-70 hover:opacity-100"
                  aria-label="Settings"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/icons/settings.svg"
                    alt=""
                    width={20}
                    height={20}
                    className="invert"
                  />
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl px-6 py-8 flex-1">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
