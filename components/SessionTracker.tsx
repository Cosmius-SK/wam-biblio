"use client";

import { useEffect } from "react";
import { startSessions } from "@/lib/session";

/**
 * Starts the attended-use clock. Invisible, and deliberately mounted once at
 * the root: a session belongs to the visit, not to any screen within it.
 */
export default function SessionTracker() {
  useEffect(() => {
    startSessions();
  }, []);
  return null;
}
