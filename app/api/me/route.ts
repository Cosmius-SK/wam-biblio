import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users/limits";
import { ownerEmail } from "@/lib/users/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The one thing the browser cannot work out for itself: whether the person
 * looking is the deployment owner.
 *
 * Returns nothing else. It exists so owner-only detail — money, mostly — can
 * be kept off other people's screens without publishing the owner's address to
 * every visitor.
 */
export async function GET() {
  const user = await currentUser();
  const owner = ownerEmail();
  return NextResponse.json({
    owner: !!user && !!owner && user.email?.toLowerCase() === owner,
  });
}
