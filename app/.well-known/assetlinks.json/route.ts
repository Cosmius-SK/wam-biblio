import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Digital Asset Links — how the Android app proves it is allowed to be this
 * site.
 *
 * Without it a Trusted Web Activity still runs, but Chrome shows the address
 * bar across the top, which rather gives the game away about it being a web
 * app. With it, the app is just the app.
 *
 * The fingerprint comes from whichever keystore signed the APK, so it lives in
 * an environment variable rather than the repo: sign a new build with a
 * different key and this has to change with it. Several may be listed at once,
 * comma-separated, which is what an upload key plus Play's signing key needs.
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE || "app.vercel.wam_biblio.twa";
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);

  const body = fingerprints.map((fp) => ({
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: pkg,
      sha256_cert_fingerprints: [fp],
    },
  }));

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
