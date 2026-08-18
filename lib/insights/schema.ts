/**
 * The privacy contract, written in code.
 *
 * This file is the whole list. If a field is not here, it is not collected —
 * and adding one is a deliberate edit to a file whose only purpose is to be
 * read by someone checking.
 *
 *   Numbers and settings, never words.
 *
 * For a group this small, insight comes from asking people. Instrumentation is
 * a poor substitute for a conversation, so this is cut to the two facts that
 * cannot be got any other way: whether someone writes, and whether they stay.
 * The rest is parked until the group passes ten.
 */

/** Everything that may leave a device. There is no other shape. */
export interface DailyInsight {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** Which device this came from, so two devices don't overwrite each other. */
  device: string;
  /** Entries written on this device, this day. */
  entries: number;
  /** Attended minutes — see docs/sessions.md for what "attended" means. */
  activeMinutes: number;
  /**
   * Which contextual mark was tapped on a presence check.
   *
   * DORMANT. `COLLECT_ANSWERS` is false and is checked at the *recording* site,
   * so nothing is written, not merely nothing sent. Turning it on requires its
   * own disclosure, and it starts from that day — no sweeping up a
   * back-catalogue people never knew was being kept.
   */
  answers?: Record<string, number>;
}

/**
 * The dormant switch. Flipping this alone is not enough and is not intended to
 * be: see docs/user-management/privacy.md before it moves.
 */
export const COLLECT_ANSWERS = false;

/**
 * Never collected. Listed explicitly because a list of what is gathered is
 * easy to write and easy to quietly extend; this is the half that keeps it
 * honest.
 *
 * - entry text, titles, summaries, raw thoughts
 * - photos, or anything derived from them
 * - questions asked of the journal, or any AI output
 * - moods and themes — they look like metadata but are derived from content,
 *   and would say more about someone's week than a paragraph would
 * - times of day, or any per-session timeline. Totals only: "opened at 2am,
 *   seven times" is exactly the thing we do not want to hold.
 */
export const NEVER_COLLECTED = [
  "entry text",
  "titles and summaries",
  "photos",
  "questions and answers",
  "moods and themes",
  "when you write, beyond a daily total",
] as const;

export const OPT_OUT_KEY = "biblio_insights_off";
