"use client";

import { useEffect } from "react";
import { onSessionStart, startSessions } from "@/lib/session";
import { describeDevice } from "@/lib/deviceId";
import { sendToday } from "@/lib/insights/collect";

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
    // Totals are absolute, so sending them twice cannot inflate anything —
    // which is what lets this fire at whatever moment happens to be quiet.
    const report = () => void sendToday();
    const onHide = () => {
      if (document.visibilityState === "hidden") report();
    };
    const stop = onSessionStart(() => {
      touch();
      report();
    });
    document.addEventListener("visibilitychange", onHide);
    startSessions();
    touch();
    report();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return null;
}
