import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { EXTENSIONS, normalizeExtensionPicks } from "@/lib/extensions";
import { getPaddle } from "@/lib/paddle";
import { findOrCreatePaddleCustomer } from "@/lib/paddle-customer";
import { isCheckoutPriceId, planById, priceInfo } from "@/lib/pricing";
import { user } from "@/lib/schema";
import { getOptionalSession } from "@/lib/session";
import { latestSubscriptionRow, proPriceFromRow } from "@/lib/session-entitlement";

export async function POST(req: NextRequest) {
  const session = await getOptionalSession(req.headers);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    priceId?: unknown;
    extensions?: unknown;
  };
  const priceId = String(body.priceId || "");
  const price = priceInfo(priceId);
  if (!price || !isCheckoutPriceId(priceId)) {
    return NextResponse.json({ error: "INVALID_PRICE" }, { status: 400 });
  }

  const plan = planById(price.plan);
  let extensions = EXTENSIONS.map((ext) => ext.client);
  if (plan.extensionCount < EXTENSIONS.length) {
    const raw = Array.isArray(body.extensions) ? body.extensions : [];
    extensions = normalizeExtensionPicks(raw);
    if (raw.length !== plan.extensionCount || extensions.length !== plan.extensionCount) {
      return NextResponse.json({ error: "INVALID_EXTENSIONS" }, { status: 400 });
    }
  }

  if (proPriceFromRow(await latestSubscriptionRow(session.user.id))) {
    return NextResponse.json({ error: "ALREADY_SUBSCRIBED" }, { status: 409 });
  }

  const rows = await getDb().select().from(user).where(eq(user.id, session.user.id)).limit(1);
  let customerId = rows[0]?.paddleCustomerId || "";
  const paddle = getPaddle();
  if (!customerId) {
    customerId = await findOrCreatePaddleCustomer(paddle.customers, {
      email: session.user.email,
      userId: session.user.id,
    });
    await getDb()
      .update(user)
      .set({ paddleCustomerId: customerId })
      .where(eq(user.id, session.user.id));
  }

  const transaction = await paddle.transactions.create({
    customerId,
    items: [{ priceId, quantity: 1 }],
    customData: { userId: session.user.id, extensions },
  });

  return NextResponse.json({ transactionId: transaction.id });
}
