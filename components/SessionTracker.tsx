"use client";

import { useEffect } from "react";
import { onSessionStart, startSessions } from "@/lib/session";
import { describeDevice } from "@/lib/deviceId";
import { beaconToday, sendToday } from "@/lib/insights/collect";

/**
 * Starts the attended-use clock, and tells the device registry this device is
 * still around — once a visit, not once a request.
 *
 * Invisible, and deliberately mounted once at the root: a session belongs to
 * the visit, not to any screen within it.
 *
 * It also reports while the visit is still happening. Reporting only at the
 * start and the end sounds tidier and loses whole visits: at the start there
 * is nothing yet to report, and at the end the page is being frozen and takes
 * the request with it. So: on arrival, every few minutes, and a beacon on the
 * way out.
 */
/** Often enough that a lost tab costs little; rare enough to be nothing. */
const HEARTBEAT_MS = 4 * 60_000;
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
    const onVisibility = () => {
      // Leaving: hand the numbers to the browser to deliver, because an
      // ordinary fetch does not outlive a phone switching apps. Returning:
      // recompute, since the clock has been stopped in the meantime.
      if (document.visibilityState === "hidden") beaconToday();
      else report();
    };
    const onLeave = () => beaconToday();
    const stop = onSessionStart(() => {
      touch();
      report();
    });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    const beat = window.setInterval(() => {
      if (document.visibilityState === "visible") report();
    }, HEARTBEAT_MS);
    startSessions();
    touch();
    report();
    return () => {
      stop();
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);
  return null;
}
