import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

/**
 * Authorizer for client-direct sync uploads. The client uploads its encrypted
 * snapshot straight to Vercel Blob (bypassing the ~4.5 MB serverless
 * request-body limit that a journal with photo thumbnails can exceed). We only
 * vouch for the path + content type and allow overwrite of that one slot — the
 * bytes are already end-to-end encrypted, so the server never sees plaintext.
 */
function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const alt = Object.keys(process.env).find((k) => k.endsWith("BLOB_READ_WRITE_TOKEN"));
  return alt ? process.env[alt] : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "Sync isn't set up yet — connect a Vercel Blob store to this project and redeploy." },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^sync\/[a-f0-9]{8,64}\.json$/.test(pathname)) {
          throw new Error("Only sync snapshots may be uploaded.");
        }
        return {
          allowedContentTypes: ["application/json"],
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: 100 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        /* the encrypted blob is the record; no post-processing needed */
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload authorization failed." },
      { status: 400 },
    );
  }
}
