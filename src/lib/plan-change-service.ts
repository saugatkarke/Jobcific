import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { extensionNames, type ExtensionClient } from "./extensions";
import { sendPlanChangeEmail } from "./mail";
import { getPaddle } from "./paddle";
import {
  billingModeFor,
  carryActive,
  chargeTodayFromSummary,
  type ChangeKind,
  type PlanChoice,
  type ValidChange,
} from "./plan-change";
import { formatPrice, planById } from "./pricing";
import { subscription } from "./schema";
import { getOptionalSession } from "./session";
import { latestSubscriptionRow } from "./session-entitlement";

export type SubscriptionRow = NonNullable<Awaited<ReturnType<typeof latestSubscriptionRow>>>;

export type ChangeRequest =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      viewer: { id: string; email: string; name?: string | null };
      row: SubscriptionRow | null;
    };

export async function changeRequestContext(headers: Headers): Promise<ChangeRequest> {
  const session = await getOptionalSession(headers);
  if (!session?.user) return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  return {
    ok: true,
    viewer: { id: session.user.id, email: session.user.email, name: session.user.name },
    row: await latestSubscriptionRow(session.user.id),
  };
}

export type ChangeSummary = {
  kind: ChangeKind;
  effectiveAt: string;
  chargeToday: number;
  nextAmount: number;
  nextBilledAt: string | null;
  dropsLegacy: boolean;
};

export class PaddleRejectedError extends Error {
  constructor(cause: unknown) {
    super("PADDLE_REJECTED");
    this.cause = cause;
  }
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function updateBody(row: SubscriptionRow, userId: string, change: ValidChange) {
  const mode = billingModeFor(change.kind);
  return {
    items: [{ priceId: change.next.price.priceId, quantity: 1 }],
    prorationBillingMode: mode,
    ...(mode === "prorated_immediately" ? { onPaymentFailure: "prevent_change" as const } : {}),
    customData: { userId, extensions: change.next.extensions },
  };
}

async function callPaddle<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error("[paddle] subscription update failed", error);
    throw new PaddleRejectedError(error);
  }
}

function summary(
  row: SubscriptionRow,
  change: ValidChange,
  immediate: { chargeToday: number; nextBilledAt: string | null } | null,
): ChangeSummary {
  const periodEnd = iso(row.currentPeriodEnd);
  return {
    kind: change.kind,
    effectiveAt: change.kind === "downgrade" ? (periodEnd ?? new Date().toISOString()) : new Date().toISOString(),
    chargeToday: immediate?.chargeToday ?? 0,
    nextAmount: change.next.price.amount,
    nextBilledAt: change.kind === "downgrade" ? periodEnd : (immediate?.nextBilledAt ?? null),
    dropsLegacy: change.current.price.legacy,
  };
}

export async function previewPlanChange(
  row: SubscriptionRow,
  userId: string,
  change: ValidChange,
): Promise<ChangeSummary> {
  if (change.kind === "downgrade") return summary(row, change, null);
  const preview = await callPaddle(() =>
    getPaddle().subscriptions.previewUpdate(row.paddleSubscriptionId, updateBody(row, userId, change)),
  );
  return summary(row, change, {
    chargeToday: chargeTodayFromSummary(preview.updateSummary?.result),
    nextBilledAt: iso(preview.nextBilledAt),
  });
}

export function planLabel(choice: PlanChoice): string {
  const names = extensionNames(choice.extensions);
  const name = planById(choice.price.plan).name;
  return names.length ? `${name} (${names.join(", ")})` : name;
}

function priceLabel(choice: PlanChoice): string {
  const per = choice.price.interval === "quarterly" ? "quarter" : choice.price.interval === "yearly" ? "year" : "month";
  return `${formatPrice(choice.price.amount)} a ${per}`;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function accountUrl(): string {
  const base = (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.jobcific.com").replace(/\/+$/, "");
  return `${base}/account`;
}

/* Our own writes set occurredAt to now so slightly older webhooks for the same change cannot roll it back. */
export async function applyPlanChange(
  row: SubscriptionRow,
  viewer: { id: string; email: string; name?: string | null },
  change: ValidChange,
): Promise<ChangeSummary> {
  const updated = await callPaddle(() =>
    getPaddle().subscriptions.update(row.paddleSubscriptionId, updateBody(row, viewer.id, change)),
  );
  const now = new Date();

  if (change.kind === "downgrade") {
    await getDb()
      .update(subscription)
      .set({
        carryPriceId: row.paddlePriceId,
        carryExtensions: row.extensions,
        carryUntil: row.currentPeriodEnd,
        paddlePriceId: change.next.price.priceId,
        extensions: change.next.extensions,
        occurredAt: now,
        updatedAt: now,
      })
      .where(eq(subscription.id, row.id));
    const result = summary(row, change, null);
    try {
      await sendPlanChangeEmail({
        to: viewer.email,
        name: viewer.name ?? undefined,
        currentPlan: planLabel(change.current),
        nextPlan: planLabel(change.next),
        effectiveDate: dateLabel(result.effectiveAt),
        nextPrice: priceLabel(change.next),
        accountUrl: accountUrl(),
      });
    } catch (error) {
      console.error("[mail] plan change email failed", error);
    }
    return result;
  }

  const periodEnd = updated.currentBillingPeriod?.endsAt;
  await getDb()
    .update(subscription)
    .set({
      paddlePriceId: change.next.price.priceId,
      extensions: change.next.extensions,
      ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd) } : {}),
      occurredAt: now,
      updatedAt: now,
    })
    .where(eq(subscription.id, row.id));
  return summary(row, change, {
    chargeToday: 0,
    nextBilledAt: iso(updated.nextBilledAt),
  });
}

export async function undoScheduledChange(
  row: SubscriptionRow,
  userId: string,
): Promise<"ok" | "NO_PENDING_CHANGE"> {
  if (!carryActive(row) || !row.carryPriceId) return "NO_PENDING_CHANGE";
  const carryPriceId = row.carryPriceId;
  const carryExtensions = (row.carryExtensions ?? null) as ExtensionClient[] | null;
  await callPaddle(() =>
    getPaddle().subscriptions.update(row.paddleSubscriptionId, {
      items: [{ priceId: carryPriceId, quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
      customData: carryExtensions ? { userId, extensions: carryExtensions } : { userId },
    }),
  );
  const now = new Date();
  await getDb()
    .update(subscription)
    .set({
      paddlePriceId: carryPriceId,
      extensions: carryExtensions,
      carryPriceId: null,
      carryExtensions: null,
      carryUntil: null,
      occurredAt: now,
      updatedAt: now,
    })
    .where(eq(subscription.id, row.id));
  return "ok";
}
