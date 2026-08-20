import { NextResponse } from "next/server";
import { blobToken, readSyncJson } from "@/lib/blobStore";
import { isRecordKey } from "@/lib/syncKeys";

export const runtime = "nodejs";

/**
 * GET /api/sync/get?id=<syncid>&key=<type>/<recordId> — fetch one per-record
 * encrypted blob for differential pull. Private stores can't be fetched from
 * the browser, so the server reads the ciphertext (authenticated) and relays
 * it. Records are small, so proxying costs little.
 */
export async function GET(request: Request) {
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Sync isn't set up yet — connect a Vercel Blob store to this project and redeploy." },
      { status: 503 },
    );
  }
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const key = params.get("key");
  if (!id || !/^[a-f0-9]{8,64}$/.test(id)) {
    return NextResponse.json({ error: "Bad sync id." }, { status: 400 });
  }
  if (!isRecordKey(key)) {
    return NextResponse.json({ error: "Bad record key." }, { status: 400 });
  }

  try {
    const blob = await readSyncJson(`sync/${id}/${key}.json`, token);
    if (blob == null) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, blob });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("sync record read failed:", reason);
    return NextResponse.json({ error: `Couldn't read the record — ${reason}` }, { status: 502 });
  }
}
