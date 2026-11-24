import { headers } from "next/headers";
import { PushPurchase } from "@/components/PushPurchase";
import { claimPurchaseEvent } from "@/lib/purchase-event";
import { getOptionalSession } from "@/lib/session";

export async function PurchaseEventBeacon() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await getOptionalSession(await headers());
  const userId = session?.user?.id;
  if (!userId) return null;
  let claim;
  try {
    claim = await claimPurchaseEvent(userId);
  } catch (error) {
    console.error("Could not claim purchase analytics event", error);
    return null;
  }
  return claim ? <PushPurchase {...claim} /> : null;
}
