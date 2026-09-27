import type { BillingInterval } from "./pricing";

export type AccountEntitlement = {
  plan: "pro" | "free";
  status: string;
  interval?: BillingInterval | null;
};

export function planStatusLabel(ent: AccountEntitlement): string {
  if (ent.plan !== "pro") return "free plan";
  const status = ent.status && ent.status !== "none" ? ent.status : "active";
  return ent.interval ? `${status} ${ent.interval}` : status;
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
