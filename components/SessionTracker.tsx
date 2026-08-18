"use client";

import { useEffect } from "react";
import { onSessionStart, startSessions } from "@/lib/session";
import { describeDevice } from "@/lib/deviceId";

/**
 * Starts the attended-use clock, and tells the device registry this device is
 * still around — once a visit, not once a request.
 *
 * Invisible, and deliberately mounted once at the root: a session belongs to
 * the visit, not to any screen within it.
 */
export default function SessionTracker() {
  useEffect(() => {
    const touch = () => {
      void fetch("/api/auth/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(describeDevice()),
      }).catch(() => {
        /* not signed in, or offline — the list simply won't move */
      });
    };
    const stop = onSessionStart(touch);
    startSessions();
    touch();
    return stop;
  }, []);
  return null;
}
