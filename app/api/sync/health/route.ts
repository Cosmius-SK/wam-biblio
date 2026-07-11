import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";

export const runtime = "nodejs";

/**
 * GET /api/sync/health — self-diagnosis for the sync backend. Exercises each
 * link (token present → test write → list → read back) and reports the RAW
 * error for whichever fails, so a broken setup names its cause instead of
 * guessing. Touches only sync/_health.json; never journal data.
 */
export async function GET() {
  const report: Record<string, string> = {};
  const token = blobToken();

  if (!token) {
    report.token =
      "missing — no *BLOB_READ_WRITE_TOKEN env var in this deployment. Connect the Blob store with the 'read-write token' box ticked, then redeploy.";
    return NextResponse.json({ ok: false, report });
  }
  // The prefix shows whether the value is a real rw token (vercel_blob_rw_…)
  // without exposing the secret.
  report.token = `found (${token.slice(0, 16)}…, ${token.length} chars)`;

  const stamp = new Date().toISOString();
  try {
    const mode = await writeSyncJson("sync/_health.json", JSON.stringify({ checkedAt: stamp }), token);
    report.write = `ok (${mode} access)`;
  } catch (e) {
    report.write = `FAILED — ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { blobs } = await list({ prefix: "sync/_health", token, limit: 1 });
    report.list = `ok (${blobs.length} blob${blobs.length === 1 ? "" : "s"} visible)`;
  } catch (e) {
    report.list = `FAILED — ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const back = (await readSyncJson("sync/_health.json", token)) as { checkedAt?: string } | null;
    report.readback = back?.checkedAt === stamp ? "ok (round trip verified)" : "stale or missing";
  } catch (e) {
    report.readback = `FAILED — ${e instanceof Error ? e.message : String(e)}`;
  }

  const ok = report.write.startsWith("ok") && report.list.startsWith("ok") && report.readback.startsWith("ok");
  return NextResponse.json({ ok, report });
}
