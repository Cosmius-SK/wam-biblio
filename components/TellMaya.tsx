"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { contextNow, markAsked, sendFeedback } from "@/lib/feedback";

/**
 * The one place someone writes *to* a person.
 *
 * They tell Maya, and Maya takes it to whoever makes this — which is how it
 * actually works, and warmer than being handed a stranger's name and asked to
 * address them. What must never soften is the fact that a human reads it:
 * everything else in biblio is private by construction and this deliberately
 * is not, so the difference is stated every single time in different colour
 * and different type, and what travels with it is shown rather than assumed.
 */
const OWNER = process.env.NEXT_PUBLIC_OWNER_NAME || "the person who set this up";

export default function TellMaya({
  open,
  question,
  promptId,
  onClose,
}: {
  open: boolean;
  question?: string;
  promptId?: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctx = contextNow();

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
    }
  }, [open]);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await sendFeedback({
        message,
        prompt: question,
        context: attach ? ctx : undefined,
      });
      if (promptId) await markAsked(promptId);
      setSent(true);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Tell Maya"
        >
          <motion.div
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            /* Sans-serif and terracotta on purpose: nothing here should look
               like the journal, because it doesn't behave like the journal. */
            className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-surface font-sans shadow-soft"
          >
            <div className="border-b border-terracotta/30 bg-terracotta/10 px-6 py-4">
              <p className="text-sm font-semibold text-terracotta">This one comes to me</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">
                Tell me and I&rsquo;ll take it to {OWNER}, who makes biblio — they do read
                these.
                <span className="text-muted">
                  {" "}
                  Your journal they never see; they couldn&rsquo;t if they wanted to.
                </span>
              </p>
            </div>

            {sent ? (
              <div className="px-6 py-8 text-center">
                <p className="text-base text-ink">Got it. Thank you — genuinely.</p>
                <p className="mt-2 text-sm text-muted">
                  I&rsquo;ll make sure {OWNER} sees it. Nothing else went with it.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 w-full rounded-full bg-ink/90 px-6 py-3 text-sm font-medium text-paper"
                >
                  Back to writing
                </button>
              </div>
            ) : (
              <div className="px-6 py-5">
                {question && <p className="text-base leading-relaxed text-ink">{question}</p>}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Anything at all. Blunt is useful."
                  className="mt-3 w-full resize-none rounded-xl border border-hairline bg-paper/50 p-4 text-sm leading-relaxed text-ink placeholder:text-muted/60 focus:border-terracotta/50 focus:outline-none"
                />

                <label className="mt-3 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted">
                  <input
                    type="checkbox"
                    checked={attach}
                    onChange={(e) => setAttach(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 accent-terracotta"
                  />
                  <span>
                    Include which version and device you&rsquo;re on
                    <span className="text-muted/70">
                      {" "}
                      — {ctx.version ? `v${ctx.version}, ` : ""}
                      {ctx.device}
                    </span>
                    . Helpful for anything broken.
                  </span>
                </label>

                {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (promptId) void markAsked(promptId);
                      onClose();
                    }}
                    className="flex-1 rounded-full border border-hairline bg-paper/50 px-4 py-3 text-sm text-muted"
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    disabled={busy || !message.trim()}
                    onClick={() => void send()}
                    className="flex-1 rounded-full bg-terracotta px-4 py-3 text-sm font-medium text-paper disabled:opacity-40"
                  >
                    {busy ? "Sending…" : "Send it"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
