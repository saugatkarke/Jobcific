import { headers } from "next/headers";
import { PushEmailVerified } from "@/components/PushEmailVerified";
import { getOptionalSession } from "@/lib/session";
import { claimVerifiedEvent } from "@/lib/verified-event";

export async function VerifiedEventBeacon() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await getOptionalSession(await headers());
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const claimedUserId = await claimVerifiedEvent(userId);
    if (!claimedUserId) return null;
    return <PushEmailVerified userId={claimedUserId} />;
  } catch (error) {
    console.error("Could not claim email verification analytics event", error);
    return null;
  }
}
