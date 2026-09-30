import { headers } from "next/headers";
import { PushPurchase } from "@/components/PushPurchase";
import { MONTHLY_AMOUNT, YEARLY_AMOUNT } from "@/lib/pricing";
import { claimPurchaseEvent } from "@/lib/purchase-event";
import { getOptionalSession } from "@/lib/session";

export async function PurchaseEventBeacon() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await getOptionalSession(await headers());
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const interval = await claimPurchaseEvent(userId);
    if (!interval) return null;
    const value = interval === "monthly" ? MONTHLY_AMOUNT : YEARLY_AMOUNT;
    return <PushPurchase interval={interval} value={value} />;
  } catch (error) {
    console.error("Could not claim purchase analytics event", error);
    return null;
  }
}
