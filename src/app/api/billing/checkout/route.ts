import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPaddle } from "@/lib/paddle";
import {
  canStartCheckout,
  intervalFromPriceId,
  isProPriceId,
} from "@/lib/pricing";
import { user } from "@/lib/schema";
import { getOptionalSession } from "@/lib/session";
import {
  latestSubscriptionRow,
  proBillingIntervalFromRow,
} from "@/lib/session-entitlement";

export async function POST(req: NextRequest) {
  const session = await getOptionalSession(req.headers);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const body = (await req.json()) as { priceId?: string };
  const priceId = String(body.priceId || "");
  if (!isProPriceId(priceId)) {
    return NextResponse.json({ error: "INVALID_PRICE" }, { status: 400 });
  }

  const requestedInterval = intervalFromPriceId(priceId);
  const subscribedInterval = proBillingIntervalFromRow(
    await latestSubscriptionRow(session.user.id),
  );
  if (
    !requestedInterval ||
    !canStartCheckout(subscribedInterval, requestedInterval)
  ) {
    return NextResponse.json({ error: "ALREADY_SUBSCRIBED" }, { status: 409 });
  }

  const rows = await getDb().select().from(user).where(eq(user.id, session.user.id)).limit(1);
  let customerId = rows[0]?.paddleCustomerId || "";
  const paddle = getPaddle();
  if (!customerId) {
    const customer = await paddle.customers.create({
      email: session.user.email,
      customData: { userId: session.user.id },
    });
    customerId = customer.id;
    await getDb()
      .update(user)
      .set({ paddleCustomerId: customerId })
      .where(eq(user.id, session.user.id));
  }

  const transaction = await paddle.transactions.create({
    customerId,
    items: [{ priceId, quantity: 1 }],
    customData: { userId: session.user.id },
  });

  return NextResponse.json({ transactionId: transaction.id });
}
