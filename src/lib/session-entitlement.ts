import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getAuth } from "./auth";
import { getDb } from "./db";
import {
  EXTENSION_NOT_INCLUDED,
  emptyEntitlement,
  entitledExtensions,
  isClientEntitled,
  resolveEntitlement,
} from "./entitlement";
import { verifyAccessJwt, type AccessClaims } from "./extension-auth";
import type { ExtensionClient } from "./extensions";
import { scheduledChange, withEffectivePlan, type ScheduledChange } from "./plan-change";
import {
  priceInfo,
  type BillingInterval,
  type CurrentPlan,
  type PriceInfo,
} from "./pricing";
import { subscription } from "./schema";
import { getOptionalSession } from "./session";

export async function extensionClaimsFromRequest(source: {
  headers: Headers;
}): Promise<AccessClaims | null> {
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

type SubscriptionRowLike = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | string | null;
  paddlePriceId: string;
};

export function proPriceFromRow(
  row: SubscriptionRowLike | null | undefined,
): PriceInfo | null {
  if (!row) return null;
  const resolved = resolveEntitlement({
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd,
  });
  if (resolved.plan !== "pro") return null;
  return priceInfo(row.paddlePriceId);
}

export function proBillingIntervalFromRow(
  row: SubscriptionRowLike | null | undefined,
): BillingInterval | null {
  return proPriceFromRow(row)?.interval ?? null;
}

export async function currentPlan(headers: Headers): Promise<CurrentPlan> {
  try {
    const session = await getOptionalSession(headers);
    if (!session?.user) return null;
    const row = withEffectivePlan(await latestSubscriptionRow(session.user.id));
    const price = proPriceFromRow(row);
    if (!price || !row) return null;
    return {
      plan: price.plan,
      legacy: price.legacy,
      extensions: entitledExtensions(resolveEntitlement(row), row),
    };
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
    return {
      authenticated: false,
      email: null,
      ...emptyEntitlement(),
      ...noPlan(),
    };
  }

  const account = await entitlementForUser(userId, email);
  if (!claims || account.plan !== "pro") return account;
  if (isClientEntitled(claims.client, account.extensions)) return account;
  return {
    ...account,
    plan: "free" as const,
    features: emptyEntitlement().features,
    reason: EXTENSION_NOT_INCLUDED,
  };
}

export async function entitlementForUser(userId: string, email: string | null) {
  if (!process.env.DATABASE_URL) {
    return {
      authenticated: true,
      email,
      ...emptyEntitlement(),
      ...noPlan(),
    };
  }

  const stored = await latestSubscriptionRow(userId);
  const row = withEffectivePlan(stored);
  const resolved = resolveEntitlement(
    row
      ? {
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
        }
      : null,
  );
  const price = proPriceFromRow(row);
  return {
    authenticated: true,
    email,
    ...resolved,
    interval: price?.interval ?? null,
    planId: price?.plan ?? null,
    legacy: price?.legacy ?? false,
    extensions: entitledExtensions(resolved, row),
    cancelAtPeriodEnd: Boolean(stored?.cancelAtPeriodEnd),
    scheduledChange: price ? scheduledChange(stored) : null,
  };
}

function noPlan() {
  return {
    interval: null,
    planId: null,
    legacy: false,
    extensions: [] as ExtensionClient[],
    cancelAtPeriodEnd: false,
    scheduledChange: null as ScheduledChange | null,
  };
}
