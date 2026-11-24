import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  LEGACY_MONTHLY_AMOUNT,
  LEGACY_YEARLY_AMOUNT,
  priceInfo,
  type BillingInterval,
  type PlanId,
} from "./pricing";
import { user } from "./schema";

export type PurchaseClaim = {
  interval: BillingInterval;
  plan: PlanId;
  value: number;
};

/* Returns the price ID to queue for the purchase analytics event. */
export function purchaseToQueue(input: {
  eventType: string;
  status: string;
  plan: "pro" | "free";
  previousPriceId: string | null;
  nextPriceId: string;
}): string | null {
  if (input.plan !== "pro" || input.status !== "active") return null;
  if (!priceInfo(input.nextPriceId)) return null;
  if (input.eventType === "subscription.created") return input.nextPriceId;
  if (
    input.eventType === "subscription.updated" &&
    input.previousPriceId &&
    input.previousPriceId !== input.nextPriceId
  ) {
    return input.nextPriceId;
  }
  return null;
}

/* Values queued before plans existed were the bare interval names. */
export function claimedPurchase(
  queued: string | null | undefined,
): PurchaseClaim | null {
  if (queued === "monthly") {
    return { interval: "monthly", plan: "bifocal", value: LEGACY_MONTHLY_AMOUNT };
  }
  if (queued === "yearly") {
    return { interval: "yearly", plan: "bifocal", value: LEGACY_YEARLY_AMOUNT };
  }
  const price = priceInfo(queued);
  if (!price) return null;
  return { interval: price.interval, plan: price.plan, value: price.amount };
}

export async function markPurchaseEventPending(
  userId: string,
  priceId: string,
): Promise<void> {
  await getDb()
    .update(user)
    .set({ purchaseEventInterval: priceId })
    .where(eq(user.id, userId));
}

export async function claimPurchaseEvent(
  userId: string,
): Promise<PurchaseClaim | null> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ queued: user.purchaseEventInterval })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    const claim = claimedPurchase(rows[0]?.queued);
    if (!claim) return null;
    await tx
      .update(user)
      .set({ purchaseEventInterval: null })
      .where(eq(user.id, userId));
    return claim;
  });
}
