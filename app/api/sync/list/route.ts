import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * List an account's per-record sync blobs (differential sync). Returns each
 * blob's path + public URL + uploadedAt so the client can fetch only the
 * records that changed since its last pull. Listing needs the read-write token
 * (server-side); the ciphertext itself is fetched directly from the public URL.
 */
function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const alt = Object.keys(process.env).find((k) => k.endsWith("BLOB_READ_WRITE_TOKEN"));
  return alt ? process.env[alt] : undefined;
}

export async function GET(request: Request) {
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Sync isn't set up yet — connect a Vercel Blob store to this project and redeploy.", items: [] },
      { status: 503 },
    );
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9]{8,64}$/.test(id)) {
    return NextResponse.json({ error: "Bad sync id.", items: [] }, { status: 400 });
  }

  try {
    const items: { pathname: string; url: string; uploadedAt: Date }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `sync/${id}/`, token, cursor, limit: 1000 });
      for (const b of page.blobs) items.push({ pathname: b.pathname, url: b.url, uploadedAt: b.uploadedAt });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Couldn't list sync.", items: [] }, { status: 502 });
  }
}
