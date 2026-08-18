import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Newsreader } from "next/font/google";
import "./globals.css";
import AmbientBackground from "@/components/AmbientBackground";
import MayaPresence from "@/components/MayaPresence";
import ThemeSync from "@/components/ThemeSync";
import AutoSync from "@/components/AutoSync";
import SessionTracker from "@/components/SessionTracker";
import Updates from "@/components/Updates";
import Tour from "@/components/tour/Tour";
import FeedbackInvite from "@/components/FeedbackInvite";
import DraftDot from "@/components/DraftDot";
import BioLock from "@/components/BioLock";
import Footer from "@/components/Footer";
import MusicToggle from "@/components/MusicToggle";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * The journal's reading face. Newsreader is warm and literary with a true
 * italic — self-hosted by next/font (no runtime request, no layout shift).
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

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
    <html lang="en" className={newsreader.variable} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        {/* Resolve and stamp the theme before anything paints, so the chosen
            paper never flashes the wrong one. Mirrors lib/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=localStorage.getItem('biblio_theme');var r=(p==='light'||p==='dark')?p:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',r)}catch(e){}",
          }}
        />
        <ThemeSync />
        <AmbientBackground />
        <MayaPresence />
        <AutoSync />
        <SessionTracker />
        <Updates />
        <Tour />
        <FeedbackInvite />
        <BioLock />
        <header className="fixed inset-x-0 top-0 z-40 h-16 backdrop-blur-md">
          {/* A quiet heartbeat along the header's edge. */}
          <span aria-hidden className="header-pulse" />
          <div className="mx-auto flex h-full max-w-2xl items-center justify-between gap-3 px-5 lg:max-w-6xl">
            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-ink transition-opacity hover:opacity-70"
            >
              biblio
            </Link>
            <div className="flex items-center gap-2">
              <MusicToggle />
              <Link
                href="/capture"
                data-tour="write"
                aria-label="New thought"
                title="New thought"
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/90 text-paper shadow-soft transition-transform hover:scale-105 active:scale-95"
              >
                <DraftDot />
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 4c4.4 0 8 2.5 8 5.7s-3.6 5.7-8 5.7c-.9 0-1.8-.1-2.6-.3-1 .8-2.4 1.3-3.9 1.4.7-.8 1.1-1.7 1.2-2.5C5 12.9 4 11.4 4 9.7 4 6.5 7.6 4 12 4Z" />
                  <circle cx="6.8" cy="19.2" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="4.4" cy="21.6" r="0.65" fill="currentColor" stroke="none" />
                </svg>
              </Link>
              <Link
                href="/settings"
                data-tour="settings"
                aria-label="Settings"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline/70 bg-surface/60 text-muted transition-colors hover:text-ink"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </Link>
            </div>
          </div>
        </header>
        {/* Holds the fixed header's place in the flow. */}
        <div aria-hidden className="h-16" />
        {/* Wide on a laptop so pages can use the room; each page decides its
            own reading width (see SettingsShell, Ask, Capture). */}
        <main className="mx-auto w-full max-w-2xl px-5 pb-28 lg:max-w-6xl">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
