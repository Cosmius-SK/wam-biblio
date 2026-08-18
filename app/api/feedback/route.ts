import { NextResponse } from "next/server";
import { blobToken, listPrefix, readSyncJson, writeSyncJson } from "@/lib/blobStore";
import { currentUser } from "@/lib/users/limits";
import { ownerEmail } from "@/lib/users/allowlist";

export const runtime = "nodejs";

/**
 * Messages written deliberately to the person who runs biblio.
 *
 * Unlike everything else here, this is *meant* to be read — which is exactly
 * why it is a separate route, a separate store, and a separate screen. Nothing
 * from a journal can reach this path, and nothing on this path is confused
 * with a journal.
 */
const MAX = 4000;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const token = blobToken();
  if (!token) return NextResponse.json({ error: "Nowhere to send it just now." }, { status: 503 });

  let body: { message?: unknown; prompt?: unknown; context?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX) : "";
  if (!message) return NextResponse.json({ error: "Nothing to send." }, { status: 400 });

  const ctx = body.context as { version?: unknown; device?: unknown } | undefined;
  const at = Date.now();
  const record = {
    at,
    from: { sub: user.sub, email: user.email ?? null, name: user.name ?? null },
    prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 200) : null,
    message,
    context: ctx
      ? {
          version: typeof ctx.version === "string" ? ctx.version.slice(0, 32) : "",
          device: typeof ctx.device === "string" ? ctx.device.slice(0, 60) : "",
        }
      : null,
  };

  try {
    await writeSyncJson(`feedback/${user.sub}/${at}.json`, JSON.stringify(record), token);
  } catch {
    return NextResponse.json({ error: "That didn't send. Try again in a moment?" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

/** Owner-only: everything people have chosen to say. */
export async function GET() {
  const user = await currentUser();
  const owner = ownerEmail();
  if (!user || !owner || user.email?.toLowerCase() !== owner) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const token = blobToken();
  if (!token) return NextResponse.json({ messages: [] });

  const files = await listPrefix("feedback/", token).catch(() => []);
  const messages = (
    await Promise.all(files.slice(0, 200).map((f) => readSyncJson(f.url, token).catch(() => null)))
  ).filter(Boolean);
  messages.sort((a, b) => Number((b as { at?: number })?.at ?? 0) - Number((a as { at?: number })?.at ?? 0));
  return NextResponse.json({ messages });
}
