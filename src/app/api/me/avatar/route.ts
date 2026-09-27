import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { avatarUrl, isAvatarSeed, isAvatarStyle } from "@/lib/avatar";
import { getDb } from "@/lib/db";
import { user } from "@/lib/schema";
import { getOptionalSession } from "@/lib/session";
import { entitlementForUser } from "@/lib/session-entitlement";

export async function POST(req: NextRequest) {
  const session = await getOptionalSession(req.headers);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const ent = await entitlementForUser(session.user.id, session.user.email);
  if (ent.plan !== "pro") {
    return NextResponse.json({ error: "PRO_REQUIRED" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    style?: unknown;
    seed?: unknown;
  } | null;
  const style = body?.style;
  const seed = body?.seed;
  if (!isAvatarStyle(style) || !isAvatarSeed(seed)) {
    return NextResponse.json({ error: "INVALID_AVATAR" }, { status: 400 });
  }

  const image = avatarUrl({ style, seed });
  await getDb()
    .update(user)
    .set({ image, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ image });
}
