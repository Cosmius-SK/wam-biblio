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

function notConfigured() {
  return NextResponse.json(
    { error: "Sync isn't set up yet — connect a Vercel Blob store to this project." },
    { status: 503 },
  );
}

// Pull the encrypted snapshot for a sync id.
export async function GET(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return notConfigured();
  const id = new URL(request.url).searchParams.get("id");
  if (!validId(id)) return NextResponse.json({ error: "Bad sync id." }, { status: 400 });

  try {
    const { blobs } = await list({ prefix: `sync/${id}` });
    if (blobs.length === 0) return NextResponse.json({ found: false });
    const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
    const blob = (await res.json()) as unknown;
    return NextResponse.json({ found: true, blob });
  } catch {
    return NextResponse.json({ error: "Couldn't read from sync." }, { status: 502 });
  }
}

// Push (overwrite) the encrypted snapshot for a sync id.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return notConfigured();

  let body: { id?: unknown; blob?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; blob?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!validId(body.id)) return NextResponse.json({ error: "Bad sync id." }, { status: 400 });
  if (!body.blob || typeof body.blob !== "object") {
    return NextResponse.json({ error: "Missing encrypted data." }, { status: 400 });
  }

  try {
    await put(`sync/${body.id}.json`, JSON.stringify(body.blob), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't write to sync." }, { status: 502 });
  }
}
