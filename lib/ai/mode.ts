import "server-only";
import { cookies } from "next/headers";
import { AI_MODE_COOKIE } from "./constants";

/**
 * The effective AI mode for a request.
 *
 * Default is "sample" ($0) — every AI feature returns a free local preview.
 * A per-device toggle (a cookie set by the in-app switch) flips it to "live".
 * Setting the env `AI_MODE=live` forces live globally, regardless of the
 * toggle (useful for a fully-live deployment). There is no way to spend
 * without an explicit opt-in.
 */
export async function aiLive(): Promise<boolean> {
  if ((process.env.AI_MODE ?? "").toLowerCase() === "live") return true;
  const store = await cookies();
  return store.get(AI_MODE_COOKIE)?.value === "live";
}
