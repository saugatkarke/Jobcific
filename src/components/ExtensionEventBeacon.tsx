import { headers } from "next/headers";
import { PushExtensionConnect } from "@/components/PushExtensionConnect";
import { claimExtensionEvent } from "@/lib/extension-event";
import { getOptionalSession } from "@/lib/session";

export async function ExtensionEventBeacon() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await getOptionalSession(await headers());
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const claimedUserId = await claimExtensionEvent(userId);
    if (!claimedUserId) return null;
    return <PushExtensionConnect userId={claimedUserId} />;
  } catch (error) {
    console.error("Could not claim extension connect analytics event", error);
    return null;
  }
}
