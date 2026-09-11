import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { emptyEntitlement, resolveEntitlement } from "./entitlement";
import { verifyAccessJwt } from "./extension-auth";
import { intervalFromPriceId, type BillingInterval } from "./pricing";
import { subscription } from "./schema";
import { getOptionalSession } from "./session";

export async function latestSubscriptionRow(userId: string) {
  if (!process.env.DATABASE_URL) return null;
  const rows = await getDb()
    .select()
    .from(subscription)
    .where(eq(subscription.userId, userId))
    .orderBy(desc(subscription.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export function proBillingIntervalFromRow(
  row:
    | {
        plan: string;
        status: string;
        currentPeriodEnd: Date | string | null;
        paddlePriceId: string;
      }
    | null
    | undefined,
): BillingInterval | null {
  if (!row) return null;
  const resolved = resolveEntitlement({
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
  });
  if (resolved.plan !== "pro") return null;
  return intervalFromPriceId(row.paddlePriceId);
}

export async function currentProBillingInterval(
  headers: Headers,
): Promise<BillingInterval | null> {
  try {
    const session = await getOptionalSession(headers);
    if (!session?.user) return null;
    return proBillingIntervalFromRow(
      await latestSubscriptionRow(session.user.id),
    );
  } catch {
    return null;
  }
}

export async function entitlementPayload(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  let userId: string | null = null;
  let email: string | null = null;

  if (bearer) {
    const claims = await verifyAccessJwt(bearer);
    if (claims) {
      userId = claims.sub;
      email = claims.email;
    }
  } else if (process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET) {
    const session = await getAuth().api.getSession({ headers: req.headers });
    if (session?.user) {
      userId = session.user.id;
      email = session.user.email;
    }
  }

  if (!userId) {
    return { authenticated: false, email: null, ...emptyEntitlement() };
  }

  if (!process.env.DATABASE_URL) {
    return { authenticated: true, email, ...emptyEntitlement() };
  }

  const row = await latestSubscriptionRow(userId);
  const resolved = resolveEntitlement(
    row
      ? {
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
        }
      : null,
  );
  return { authenticated: true, email, ...resolved };
}
