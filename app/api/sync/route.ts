import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * End-to-end encrypted sync over Vercel Blob. The client encrypts a snapshot
 * with the user's passphrase and derives an opaque sync id from it; the server
 * only ever stores and returns ciphertext. It never sees the passphrase or any
 * plaintext.
 */
function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{8,64}$/.test(id);
}

/**
 * The Blob read/write token. Vercel names it BLOB_READ_WRITE_TOKEN by default,
 * but a store connected with a custom prefix (or a second store) becomes
 * <PREFIX>_BLOB_READ_WRITE_TOKEN — so fall back to any matching var.
 */
function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const alt = Object.keys(process.env).find((k) => k.endsWith("BLOB_READ_WRITE_TOKEN"));
  return alt ? process.env[alt] : undefined;
}

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Sync isn't set up yet — connect a Vercel Blob store to this project and redeploy.",
    },
    { status: 503 },
  );
}

// Pull the encrypted snapshot for a sync id.
export async function GET(request: Request) {
  const token = blobToken();
  if (!token) return notConfigured();
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return NextResponse.json({ error: "Bad sync id." }, { status: 400 });

  try {
    const { blobs } = await list({ prefix: `sync/${id}`, token });
    if (blobs.length === 0) return NextResponse.json({ found: false });
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
    const blob = (await res.json()) as unknown;
    return NextResponse.json({ found: true, blob });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sync read failed:", reason);
    return NextResponse.json({ error: `Couldn't read from sync — ${reason}` }, { status: 502 });
  }
}

// Push (overwrite) the encrypted snapshot for a sync id.
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

  // Optional per-record key for differential sync (e.g. "e/<uuid>"); without it
  // this writes the legacy single-blob snapshot.
  let path = `sync/${body.id}.json`;
  if (typeof body.key === "string" && body.key) {
    if (!/^[eprk]\/[A-Za-z0-9._-]{1,200}$/.test(body.key)) {
      return NextResponse.json({ error: "Bad record key." }, { status: 400 });
    }
    path = `sync/${body.id}/${body.key}.json`;
  }

  try {
    await put(path, JSON.stringify(body.blob), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sync write failed:", reason);
    return NextResponse.json({ error: `Couldn't write to sync — ${reason}` }, { status: 502 });
  }
}
