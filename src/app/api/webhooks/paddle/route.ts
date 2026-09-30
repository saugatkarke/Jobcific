import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPaddle } from "@/lib/paddle";
import { mapPaddleSubscription, shouldApplyEvent } from "@/lib/paddle-map";
import {
  markPurchaseEventPending,
  purchaseIntervalToQueue,
} from "@/lib/purchase-event";
import { paddleEvent, subscription, user } from "@/lib/schema";

type PaddleEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const signature = req.headers.get("paddle-signature") || "";
  const raw = await req.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET || "";
  let event: PaddleEvent;
  try {
    event = (await getPaddle().webhooks.unmarshal(
      raw,
      secret,
      signature,
    )) as unknown as PaddleEvent;
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(paddleEvent)
    .where(eq(paddleEvent.eventId, event.eventId))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const type = String(event.eventType || "");
  if (
    type === "subscription.created" ||
    type === "subscription.updated" ||
    type === "subscription.canceled" ||
    type === "subscription.past_due"
  ) {
    const data = event.data as Parameters<typeof mapPaddleSubscription>[0]["data"];
    let mapped = mapPaddleSubscription({ occurredAt: event.occurredAt, data });
    if (!mapped && data.customerId) {
      const owners = await db
        .select()
        .from(user)
        .where(eq(user.paddleCustomerId, String(data.customerId)))
        .limit(1);
      if (owners[0]) {
        mapped = mapPaddleSubscription({
          occurredAt: event.occurredAt,
          data: { ...data, customData: { userId: owners[0].id } },
        });
      }
    }
    if (!mapped) {
      console.info("[paddle] unresolved subscription event", event.eventId);
    } else {
      const prior = await db
        .select()
        .from(subscription)
        .where(eq(subscription.paddleSubscriptionId, mapped.paddleSubscriptionId))
        .limit(1);
      if (shouldApplyEvent(prior[0]?.occurredAt, mapped.occurredAt)) {
        const row = {
          id: prior[0]?.id || crypto.randomUUID(),
          userId: mapped.userId,
          paddleSubscriptionId: mapped.paddleSubscriptionId,
          paddlePriceId: mapped.paddlePriceId,
          status: mapped.status,
          plan: mapped.plan,
          currentPeriodEnd: mapped.currentPeriodEnd,
          cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
          occurredAt: mapped.occurredAt,
          updatedAt: new Date(),
        };
        if (prior[0]) {
          await db.update(subscription).set(row).where(eq(subscription.id, prior[0].id));
        } else {
          await db.insert(subscription).values(row);
        }
        if (mapped.paddleCustomerId) {
          await db
            .update(user)
            .set({ paddleCustomerId: mapped.paddleCustomerId })
            .where(eq(user.id, mapped.userId));
        }
        const purchaseInterval = purchaseIntervalToQueue({
          eventType: type,
          status: mapped.status,
          plan: mapped.plan,
          previousPriceId: prior[0]?.paddlePriceId ?? null,
          nextPriceId: mapped.paddlePriceId,
        });
        if (purchaseInterval) {
          await markPurchaseEventPending(mapped.userId, purchaseInterval);
        }
      }
    }
  }

  await db.insert(paddleEvent).values({
    eventId: event.eventId,
    eventType: type,
    processedAt: new Date(),
  });
  return NextResponse.json({ ok: true });
}
