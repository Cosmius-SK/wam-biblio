import { readFileSync } from "node:fs";

/**
 * The version and the release notes are read from the repo at build time, so
 * CHANGELOG.md stays the single source of truth and the in-app "what's new"
 * card can never drift from it. No runtime file access, which keeps this
 * working the same way on every host.
 */
function releaseInfo() {
  const version = JSON.parse(readFileSync("./package.json", "utf8")).version ?? "0.0.0";
  let notes = [];
  try {
    const md = readFileSync("./CHANGELOG.md", "utf8");
    const entry = md.split(/^## /m)[1] ?? "";

    // Only the halves a reader is the audience for. "Under the hood" is for
    // whoever maintains this, and "For the owner" is about running the
    // deployment — costs, keys, admin tools. None of that should appear in
    // someone else's journal.
    const READER_SECTIONS = ["What's new", "Fixed"];
    const bullets = [];
    for (const section of entry.split(/^### /m)) {
      if (!READER_SECTIONS.some((h) => section.startsWith(h))) continue;
      // Everything past the "Fixed" line itself. A heading is not a note, and
      // the folding below would otherwise glue it onto the last bullet of the
      // section before — and then stop, taking the whole of Fixed with it.
      const body = section.slice(section.indexOf("\n") + 1);
      let started = false; // a list has begun *in this section*
      let broken = false; // ...and a blank line has interrupted it
      for (const raw of body.split("\n")) {
        const line = raw.trim();
        if (line.startsWith("- ")) {
          bullets.push(line.slice(2));
          started = true;
          broken = false;
        } else if (!line) {
          // A blank line between bullets is ordinary markdown and used to end
          // the whole list here, which silently dropped every note after it —
          // three times, each found by noticing something missing from the
          // card rather than by anything failing. It only ends the list if
          // prose follows.
          broken = true;
        } else if (started && !broken && !line.startsWith("#")) {
          // Bullets wrap across lines in the file; fold the continuations back
          // in so a note never arrives cut off mid-sentence.
          bullets[bullets.length - 1] += ` ${line}`;
        } else if (started && broken) {
          break; // prose after the list
        }
      }
    }
    notes = bullets
      .map((b) =>
        b
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/`/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      // Eight, not six. A release with both halves full was silently losing
      // the last notes off the end, and the card scrolls.
      .slice(0, 8);
  } catch {
    /* no changelog yet — the card simply won't appear */
  }
  return { version, notes };
}

const { version, notes } = releaseInfo();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_RELEASE_NOTES: JSON.stringify(notes),
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  async headers() {
    return [
      {
        // The worker must never be served stale, or an update can never arrive.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
