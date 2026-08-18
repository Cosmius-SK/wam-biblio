"use client";

import { useEffect, useRef, useState } from "react";
import { maya } from "@/lib/maya";
import { duePrompt, markAsked, type Prompt } from "@/lib/feedback";
import { onSessionStart } from "@/lib/session";
import TellMaya from "./TellMaya";

/**
 * When Maya asks how it's going.
 *
 * Three times over a fortnight, one question each, never the same one twice.
 * Timed to a new visit rather than to a clock, so it arrives when someone is
 * already here rather than interrupting them into being here.
 *
 * She offers; she doesn't open anything. Ignoring her is a complete answer and
 * costs the question — it is never asked again.
 */
export default function FeedbackInvite() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [open, setOpen] = useState(false);
  const offered = useRef(false);

  useEffect(() => {
    const consider = () => {
      if (offered.current) return;
      void (async () => {
        const due = await duePrompt();
        if (!due || offered.current) return;
        offered.current = true;
        // Long enough after arrival that it doesn't collide with her greeting.
        window.setTimeout(() => {
          maya.invite("Can I ask you something? It's not about the journal.", "go on", () => {
            setPrompt(due);
            setOpen(true);
          });
        }, 12_000);
      })();
    };
    const stop = onSessionStart(consider);
    consider();
    return stop;
  }, []);

  return (
    <TellMaya
      open={open}
      question={prompt?.question}
      promptId={prompt?.id}
      onClose={() => {
        setOpen(false);
        // Offered and closed is an answer of its own; don't ask again.
        if (prompt) void markAsked(prompt.id);
      }}
    />
  );
}
