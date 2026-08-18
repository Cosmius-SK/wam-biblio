"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onDataChange } from "@/lib/db";
import { draftHint } from "@/lib/drafts";

/**
 * A quiet mark on the new-thought button when something unfinished is waiting.
 * Without it a draft can sit there unseen, which is only marginally better than
 * losing it. Reads the synchronous hint so it is right on the first paint.
 */
export default function DraftDot() {
  const pathname = usePathname();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const check = () => setWaiting(draftHint());
    check();
    const unsubscribe = onDataChange(check);
    document.addEventListener("visibilitychange", check);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", check);
    };
  }, [pathname]);

  // On the capture screen it is in front of them already.
  if (!waiting || pathname === "/capture") return null;

  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-terracotta ring-2 ring-paper"
    />
  );
}
