import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, isGateConfigured, expectedToken, safeEqual } from "@/lib/auth";

/**
 * Gate every page and API route behind the passcode. The unlock screen and its
 * API are always public; static assets are excluded via the matcher below.
 * If no passcode is configured, the gate is off (fail-open).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public paths.
  if (pathname.startsWith("/unlock") || pathname.startsWith("/api/unlock")) {
    return NextResponse.next();
  }

  // No passcode set → gate disabled.
  if (!isGateConfigured()) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && safeEqual(token, await expectedToken())) {
    return NextResponse.next();
  }

  // Locked. API calls get a clean 401; pages redirect to the unlock screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked — unlock the journal first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname && pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals, Vercel instrumentation, and static files.
  matcher: ["/((?!_next/static|_next/image|_vercel|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
