import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * GET /api/sync/health — self-diagnosis for the sync backend. Exercises each
 * link (token present → test write → list) and reports the RAW error for
 * whichever fails, so a broken setup names its cause instead of guessing.
 * Touches only sync/_health.json; never journal data.
 */
function tokenInfo(): { name: string; token: string } | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { name: "BLOB_READ_WRITE_TOKEN", token: process.env.BLOB_READ_WRITE_TOKEN };
  }
  const alt = Object.keys(process.env).find(
    (k) => k.endsWith("BLOB_READ_WRITE_TOKEN") && process.env[k],
  );
  return alt ? { name: alt, token: process.env[alt]! } : null;
}

export async function GET() {
  const report: Record<string, string> = {};
  const info = tokenInfo();

  if (!info) {
    report.token =
      "missing — no *BLOB_READ_WRITE_TOKEN env var in this deployment. Connect the Blob store with the 'read-write token' box ticked, then redeploy.";
    return NextResponse.json({ ok: false, report });
  }
  // The prefix shows whether the value is a real rw token (vercel_blob_rw_…)
  // without exposing the secret.
  report.token = `${info.name} = ${info.token.slice(0, 16)}… (${info.token.length} chars)`;

  try {
    await put("sync/_health.json", JSON.stringify({ checkedAt: new Date().toISOString() }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: info.token,
    });
    report.write = "ok";
  } catch (e) {
    report.write = `FAILED — ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { blobs } = await list({ prefix: "sync/_health", token: info.token, limit: 1 });
    report.list = `ok (${blobs.length} blob${blobs.length === 1 ? "" : "s"} visible)`;
  } catch (e) {
    report.list = `FAILED — ${e instanceof Error ? e.message : String(e)}`;
  }

  const ok = report.write === "ok" && report.list.startsWith("ok");
  return NextResponse.json({ ok, report });
}
