import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import AmbientBackground from "@/components/AmbientBackground";
import Nav from "@/components/Nav";
import ModeToggle from "@/components/ModeToggle";
import MusicToggle from "@/components/MusicToggle";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "biblio — a living journal",
  description:
    "Speak or type a raw thought; it becomes a coherent, self-organizing story of you.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "biblio" },
};

export const viewport: Viewport = {
  themeColor: "#F7F3EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full font-sans">
        <AmbientBackground />
        <header className="sticky top-0 z-20 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4">
            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-ink transition-opacity hover:opacity-70"
            >
              biblio
            </Link>
            <div className="flex items-center gap-2">
              <MusicToggle />
              <ModeToggle />
              <Link
                href="/capture"
                className="rounded-full bg-ink/90 px-4 py-1.5 text-sm font-medium text-paper shadow-soft transition-transform hover:scale-[1.03] active:scale-95"
              >
                New thought
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-5 pb-28 pt-2">
          <Nav />
          {children}
        </main>
        <footer className="mx-auto max-w-2xl px-5 pb-10 text-center">
          <Link
            href="/vault"
            className="text-xs text-muted/70 transition-colors hover:text-ink"
          >
            Backup &amp; restore
          </Link>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
