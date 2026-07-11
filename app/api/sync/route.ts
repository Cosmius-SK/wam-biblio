import { NextResponse } from "next/server";
import { blobToken, readSyncJson, writeSyncJson } from "@/lib/blobStore";

export const runtime = "nodejs";

/**
 * End-to-end encrypted sync over Vercel Blob. The client encrypts every
 * payload before it gets here and derives an opaque sync id; this route only
 * ever stores and returns ciphertext, adapting to the store's access mode
 * (private or public) via lib/blobStore.
 */
function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{8,64}$/.test(id);
}

function validKey(key: unknown): key is string {
  return typeof key === "string" && /^[eprk]\/[A-Za-z0-9._-]{1,200}$/.test(key);
}

function notConfigured() {
  return NextResponse.json(
    { error: "Sync isn't set up yet — connect a Vercel Blob store to this project and redeploy." },
    { status: 503 },
  );
}

// Pull the legacy single-blob encrypted snapshot for a sync id.
export async function GET(request: Request) {
  const token = blobToken();
  if (!token) return notConfigured();
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return NextResponse.json({ error: "Bad sync id." }, { status: 400 });

  try {
    const blob = await readSyncJson(`sync/${id}.json`, token);
    if (blob == null) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, blob });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sync read failed:", reason);
    return NextResponse.json({ error: `Couldn't read from sync — ${reason}` }, { status: 502 });
  }
}

// Push (overwrite) an encrypted snapshot: a per-record blob when `key` is
// given (differential sync), else the legacy single-blob snapshot.
export async function POST(request: Request) {
  const token = blobToken();
  if (!token) return notConfigured();

  let body: { id?: unknown; blob?: unknown; key?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; blob?: unknown; key?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!validId(body.id)) return NextResponse.json({ error: "Bad sync id." }, { status: 400 });
  if (!body.blob || typeof body.blob !== "object") {
    return NextResponse.json({ error: "Missing encrypted data." }, { status: 400 });
  }

  let path = `sync/${body.id}.json`;
  if (body.key !== undefined) {
    if (!validKey(body.key)) return NextResponse.json({ error: "Bad record key." }, { status: 400 });
    path = `sync/${body.id}/${body.key}.json`;
  }

  try {
    await writeSyncJson(path, JSON.stringify(body.blob), token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sync write failed:", reason);
    return NextResponse.json({ error: `Couldn't write to sync — ${reason}` }, { status: 502 });
  }
}
