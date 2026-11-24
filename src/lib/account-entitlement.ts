import { extensionNames, type ExtensionClient } from "./extensions";
import type { ScheduledChange } from "./plan-change";
import { planById, type BillingInterval, type PlanId } from "./pricing";

export type AccountEntitlement = {
  plan: "pro" | "free";
  status: string;
  interval?: BillingInterval | null;
  planId?: PlanId | null;
  legacy?: boolean;
  extensions?: ExtensionClient[];
  cancelAtPeriodEnd?: boolean;
  scheduledChange?: ScheduledChange | null;
};

export function planLabel(planId: PlanId, extensions: readonly ExtensionClient[]): string {
  const name = planById(planId).name;
  const included = extensionNames(extensions);
  return included.length ? `${name} (${included.join(", ")})` : name;
}

export function planStatusLabel(ent: AccountEntitlement): string {
  if (ent.plan !== "pro") return "free plan";
  const status = ent.status && ent.status !== "none" ? ent.status : "active";
  return ent.interval ? `${status} ${ent.interval}` : status;
}

/* For example "Bifocal (Indeed, Seek)". Empty when the plan is unknown. */
export function planSummary(ent: AccountEntitlement): string {
  if (ent.plan !== "pro" || !ent.planId) return "";
  return planLabel(ent.planId, ent.extensions ?? []);
}

export function toAccountEntitlement(data: AccountEntitlement): AccountEntitlement {
  return {
    plan: data.plan,
    status: data.status,
    interval: data.interval ?? null,
    planId: data.planId ?? null,
    legacy: data.legacy ?? false,
    extensions: data.extensions ?? [],
    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    scheduledChange: data.scheduledChange ?? null,
  };
}

export const CHECKOUT_PENDING_NOTICE =
  "Payment received. Pro unlocks in a moment.";

export function needsEntitlementFetch(
  checkoutSuccess: boolean,
  ent: AccountEntitlement | null,
): boolean {
  return !ent || (checkoutSuccess && ent.plan !== "pro");
}

export function checkoutNotice(
  checkoutSuccess: boolean,
  ent: AccountEntitlement | null,
): string {
  return checkoutSuccess && ent?.plan !== "pro" ? CHECKOUT_PENDING_NOTICE : "";
}
