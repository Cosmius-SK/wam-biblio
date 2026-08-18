"use client";

/**
 * Maya showing someone around.
 *
 * Written as her speaking, not as documentation with a Next button on it. The
 * order follows docs/user-management/onboarding.md: who she is, what happens to
 * their words, where things are, and then out of the way.
 *
 * Act 5 of that document — the private-voice choice — is deliberately absent
 * until on-device transcription exists. Offering a choice we cannot yet honour
 * would be worse than not offering it.
 */
export interface TourStep {
  id: string;
  /** A CSS selector to spotlight, when the step is about a real thing. */
  target?: string;
  title: string;
  body: string;
  /** Optional secondary action, e.g. going somewhere to set something up. */
  action?: { label: string; href: string };
  /** Shown only where it applies. */
  when?: "ios" | "android" | "always";
}

export const STEPS: TourStep[] = [
  {
    id: "hello",
    title: "Hello. I'm Maya.",
    body: "I live at the bottom of the screen. I'll say something now and then — when you've written a while, or when the page has gone quiet — and otherwise I'll leave you to it. If you'd rather I were silent, that's a switch in Settings and I won't take it personally.",
  },
  {
    id: "promise",
    title: "Your words stay yours",
    body: "Everything you write is locked on this device before any of it leaves. Whoever runs biblio holds unreadable text and two numbers — how many entries you wrote, and how long you spent here. Not your words, not your photos, not your moods. There's no key on any server to read them with.",
    action: { label: "See exactly what's kept", href: "/settings/privacy" },
  },
  {
    id: "ai",
    title: "One thing to know about the AI",
    body: "When you ask biblio to shape an entry, that text is sent to Anthropic's model to do the shaping — through the account of whoever set this up. They can't read your journal, but your words do pass through their account on the way. You can turn that off entirely and biblio still works.",
  },
  {
    id: "write",
    target: '[data-tour="write"]',
    title: "This is where you write",
    body: "Speak it or type it. Don't worry how it comes out — that's rather the point. You can add a photo, say where you were, and choose how much help you want with the words.",
  },
  {
    id: "tabs",
    target: '[data-tour="tabs"]',
    title: "Three ways to look back",
    body: "Timeline is everything as it happened. Gallery is the pictures. Ask lets you put a question to your own journal and get an answer drawn only from what you've written.",
  },
  {
    id: "settings",
    target: '[data-tour="settings"]',
    title: "Everything else lives here",
    body: "My voice, how the pages look, what's kept about you, and the locks on the journal. Nothing in there can break anything — have a wander when you feel like it.",
  },
  {
    id: "lock",
    title: "Worth doing once",
    body: "A passcode seals your journal so that even someone inside your Google account can't open it. You'll be given six words to keep somewhere safe — they're the only way back if you forget it, and nobody can recover them for you. Not even the person who set this up.",
    action: { label: "Set it up", href: "/settings/security" },
  },
  {
    id: "install",
    title: "Keep it on your home screen",
    body: "biblio works better as an app than as a tab — it opens instantly and works without a signal. On iPhone: tap Share, then Add to Home Screen. On Android: the menu, then Install app.",
  },
  {
    id: "done",
    title: "That's everything",
    body: "There's nothing else to learn. Write one true sentence when you feel like it, and I'll be here.",
  },
];
