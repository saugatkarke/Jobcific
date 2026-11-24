import { entitledExtensions, resolveEntitlement } from "./entitlement";
import { EXTENSIONS, normalizeExtensionPicks, type ExtensionClient } from "./extensions";
import {
  isCheckoutPriceId,
  planById,
  priceInfo,
  type BillingInterval,
  type PlanId,
  type PriceInfo,
} from "./pricing";

export type PlanRow = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | string | null;
  cancelAtPeriodEnd: boolean;
  paddlePriceId: string;
  extensions: string[] | null;
  carryPriceId: string | null;
  carryExtensions: string[] | null;
  carryUntil: Date | string | null;
};

function toMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function carryActive(
  row: Pick<PlanRow, "carryPriceId" | "carryUntil"> | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return Boolean(row?.carryPriceId) && toMs(row?.carryUntil) > nowMs;
}

/* Until a scheduled downgrade takes effect, the user keeps the plan stored in the carry columns. */
export function withEffectivePlan<T extends Pick<PlanRow, "paddlePriceId" | "extensions" | "carryPriceId" | "carryExtensions" | "carryUntil">>(
  row: T | null | undefined,
  nowMs: number = Date.now(),
): T | null {
  if (!row) return null;
  if (!carryActive(row, nowMs)) return row;
  return {
    ...row,
    paddlePriceId: row.carryPriceId as string,
    extensions: row.carryExtensions,
  };
}

export type ScheduledChange = {
  planId: PlanId;
  interval: BillingInterval;
  extensions: ExtensionClient[];
  effectiveAt: string;
};

export function scheduledChange(
  row: PlanRow | null | undefined,
  nowMs: number = Date.now(),
): ScheduledChange | null {
  if (!row || !carryActive(row, nowMs)) return null;
  const price = priceInfo(row.paddlePriceId);
  if (!price) return null;
  return {
    planId: price.plan,
    interval: price.interval,
    extensions: extensionsForPrice(price, row.extensions),
    effectiveAt: new Date(toMs(row.carryUntil)).toISOString(),
  };
}

function extensionsForPrice(price: PriceInfo, picks: readonly string[] | null): ExtensionClient[] {
  return entitledExtensions(
    { plan: "pro", status: "active", currentPeriodEnd: null, features: { hideJobs: true, atsResults: true } },
    { paddlePriceId: price.priceId, extensions: picks },
  );
}

export type ChangeKind = "upgrade" | "downgrade" | "interval";

export type ChangeError =
  | "NO_SUBSCRIPTION"
  | "NOT_ACTIVE"
  | "CANCEL_SCHEDULED"
  | "CHANGE_PENDING"
  | "INVALID_PRICE"
  | "INVALID_EXTENSIONS"
  | "SWAP_NOT_SUPPORTED"
  | "NO_CHANGE";

export const CHANGE_ERROR_STATUS: Record<ChangeError, number> = {
  NO_SUBSCRIPTION: 409,
  NOT_ACTIVE: 409,
  CANCEL_SCHEDULED: 409,
  CHANGE_PENDING: 409,
  INVALID_PRICE: 400,
  INVALID_EXTENSIONS: 400,
  SWAP_NOT_SUPPORTED: 400,
  NO_CHANGE: 400,
};

export type PlanChoice = { price: PriceInfo; extensions: ExtensionClient[] };

export type ValidChange = {
  ok: true;
  kind: ChangeKind;
  current: PlanChoice;
  next: PlanChoice;
};

export type ChangeCheck = ValidChange | { ok: false; error: ChangeError };

function fail(error: ChangeError): ChangeCheck {
  return { ok: false, error };
}

/* Statuses that Paddle accepts an item change for. */
const CHANGEABLE_STATUSES = new Set(["active", "trialing"]);

export function validateChange({
  row,
  priceId,
  extensions,
  nowMs = Date.now(),
}: {
  row: PlanRow | null | undefined;
  priceId: unknown;
  extensions: unknown;
  nowMs?: number;
}): ChangeCheck {
  if (!row || resolveEntitlement(row, nowMs).plan !== "pro") return fail("NO_SUBSCRIPTION");
  const currentPrice = priceInfo(row.paddlePriceId);
  if (!currentPrice) return fail("NO_SUBSCRIPTION");
  if (!CHANGEABLE_STATUSES.has(row.status)) return fail("NOT_ACTIVE");
  if (row.cancelAtPeriodEnd) return fail("CANCEL_SCHEDULED");
  if (carryActive(row, nowMs)) return fail("CHANGE_PENDING");

  const nextId = String(priceId || "");
  const nextPrice = priceInfo(nextId);
  if (!nextPrice || !isCheckoutPriceId(nextId)) return fail("INVALID_PRICE");

  const count = planById(nextPrice.plan).extensionCount;
  let nextExtensions = EXTENSIONS.map((ext) => ext.client);
  if (count < EXTENSIONS.length) {
    const raw = Array.isArray(extensions) ? extensions : [];
    nextExtensions = normalizeExtensionPicks(raw);
    if (raw.length !== count || nextExtensions.length !== count) {
      return fail("INVALID_EXTENSIONS");
    }
  }

  const currentExtensions = extensionsForPrice(currentPrice, row.extensions);
  const keeps = (a: readonly ExtensionClient[], b: readonly ExtensionClient[]) =>
    b.every((ext) => a.includes(ext));
  if (nextExtensions.length > currentExtensions.length) {
    if (!keeps(nextExtensions, currentExtensions)) return fail("SWAP_NOT_SUPPORTED");
  } else if (nextExtensions.length < currentExtensions.length) {
    if (!keeps(currentExtensions, nextExtensions)) return fail("SWAP_NOT_SUPPORTED");
  } else if (!keeps(currentExtensions, nextExtensions)) {
    return fail("SWAP_NOT_SUPPORTED");
  }

  const intervalChanged = nextPrice.interval !== currentPrice.interval;
  if (!intervalChanged && nextExtensions.length === currentExtensions.length) {
    return fail("NO_CHANGE");
  }

  const kind: ChangeKind = intervalChanged
    ? "interval"
    : nextExtensions.length > currentExtensions.length
      ? "upgrade"
      : "downgrade";

  return {
    ok: true,
    kind,
    current: { price: currentPrice, extensions: currentExtensions },
    next: { price: nextPrice, extensions: nextExtensions },
  };
}

export function billingModeFor(kind: ChangeKind) {
  return kind === "downgrade"
    ? ("full_next_billing_period" as const)
    : ("prorated_immediately" as const);
}

/* Paddle reports the immediate charge or credit in minor units. */
export function chargeTodayFromSummary(
  result: { action: "credit" | "charge"; amount: string } | null | undefined,
): number {
  if (!result) return 0;
  const cents = Number(result.amount);
  if (!Number.isFinite(cents)) return 0;
  const amount = cents / 100;
  return result.action === "credit" ? -amount : amount;
}
