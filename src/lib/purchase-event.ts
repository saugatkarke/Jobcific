import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { intervalFromPriceId, type BillingInterval } from "./pricing";
import { user } from "./schema";

export function purchaseIntervalToQueue(input: {
  eventType: string;
  status: string;
  plan: "pro" | "free";
  previousPriceId: string | null;
  nextPriceId: string;
}): BillingInterval | null {
  if (input.plan !== "pro" || input.status !== "active") return null;
  const interval = intervalFromPriceId(input.nextPriceId);
  if (!interval) return null;
  if (input.eventType === "subscription.created") return interval;
  if (
    input.eventType === "subscription.updated" &&
    input.previousPriceId &&
    input.previousPriceId !== input.nextPriceId
  ) {
    return interval;
  }
  return null;
}

export function claimedPurchaseInterval(
  interval: string | null | undefined,
): BillingInterval | null {
  if (interval === "monthly" || interval === "yearly") return interval;
  return null;
}

export async function markPurchaseEventPending(
  userId: string,
  interval: BillingInterval,
): Promise<void> {
  await getDb()
    .update(user)
    .set({ purchaseEventInterval: interval })
    .where(eq(user.id, userId));
}

export async function claimPurchaseEvent(
  userId: string,
): Promise<BillingInterval | null> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ interval: user.purchaseEventInterval })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    const interval = claimedPurchaseInterval(rows[0]?.interval);
    if (!interval) return null;
    await tx
      .update(user)
      .set({ purchaseEventInterval: null })
      .where(eq(user.id, userId));
    return interval;
  });
}
