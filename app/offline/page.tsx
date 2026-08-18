export const metadata = { title: "biblio — offline" };

/**
 * Shown only when a page is asked for with no network and nothing cached.
 * Writing still works from here — entries live on the device — so this says so
 * rather than presenting a dead end.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <div className="mx-auto mb-6 h-12 w-12 animate-breathe rounded-full bg-gradient-to-br from-terracotta/40 via-lavender/40 to-sage/40" />
      <h1 className="font-serif text-2xl text-ink">No connection</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This page hasn&rsquo;t been here before, so there&rsquo;s nothing to show yet. Your
        journal itself is on this device and opens perfectly well without a signal — go back,
        and carry on.
      </p>
      <p className="mt-6 text-xs text-muted/70">
        Anything you write now is saved locally and syncs when you&rsquo;re back.
      </p>
    </main>
  );
}
