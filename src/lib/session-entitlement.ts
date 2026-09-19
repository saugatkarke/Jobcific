import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { emptyEntitlement, resolveEntitlement } from "./entitlement";
import { verifyAccessJwt } from "./extension-auth";
import { intervalFromPriceId, type BillingInterval } from "./pricing";
import { subscription } from "./schema";
import { getOptionalSession } from "./session";

export async function extensionClaimsFromRequest(source: {
  headers: Headers;
}): Promise<{ sub: string; email: string } | null> {
  const header = source.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyAccessJwt(match[1]);
}

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
  const claims = await extensionClaimsFromRequest(req);
  let userId: string | null = claims?.sub ?? null;
  let email: string | null = claims?.email ?? null;

  if (!claims && process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET) {
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
