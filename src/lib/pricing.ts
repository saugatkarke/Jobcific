export const MONTHLY_LABEL = "$4.99 / month";
export const YEARLY_LABEL = "$39 / year";
export const PRODUCT_NAME = "Jobcific Pro";
export const MONTHLY_AMOUNT = 4.99;
export const YEARLY_AMOUNT = 39;

export type BillingInterval = "monthly" | "yearly";

export function monthlyPriceId(): string {
  return process.env.PADDLE_PRICE_ID_MONTHLY || "";
}

export function yearlyPriceId(): string {
  return process.env.PADDLE_PRICE_ID_YEARLY || "";
}

export function isProPriceId(priceId: string): boolean {
  const id = String(priceId || "");
  return Boolean(id) && (id === monthlyPriceId() || id === yearlyPriceId());
}

export function intervalFromPriceId(priceId: string): BillingInterval | null {
  const id = String(priceId || "");
  if (!id) return null;
  if (id === monthlyPriceId()) return "monthly";
  if (id === yearlyPriceId()) return "yearly";
  return null;
}

export function defaultPricingInterval(
  subscribedInterval: BillingInterval | null,
): BillingInterval {
  return subscribedInterval ? "yearly" : "monthly";
}

export function pricingCardOrder(
  isAuthenticated: boolean,
): Array<"free" | "pro"> {
  return isAuthenticated ? ["pro", "free"] : ["free", "pro"];
}

export function pricingIntervalTabs(
  subscribedInterval: BillingInterval | null = null,
): BillingInterval[] {
  return subscribedInterval === "monthly"
    ? ["yearly", "monthly"]
    : ["monthly", "yearly"];
}

export function pricingProCta({
  subscribedInterval,
  selectedInterval,
  pending = false,
}: {
  subscribedInterval: BillingInterval | null;
  selectedInterval: BillingInterval;
  pending?: boolean;
}): { label: string; disabled: boolean; showLegal: boolean } {
  const alreadySubscribed =
    subscribedInterval === "yearly" || subscribedInterval === selectedInterval;
  if (alreadySubscribed) {
    return { label: "Subscribed", disabled: true, showLegal: false };
  }
  return {
    label: pending ? "Starting…" : "Subscribe",
    disabled: pending,
    showLegal: true,
  };
}

export function canStartCheckout(
  subscribedInterval: BillingInterval | null,
  requestedInterval: BillingInterval,
): boolean {
  return !pricingProCta({
    subscribedInterval,
    selectedInterval: requestedInterval,
  }).disabled;
}

export function formatPrice(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  return `$${amount.toFixed(2)}`;
}

export function yearlyDiscountPercent(): number {
  const full = MONTHLY_AMOUNT * 12;
  if (full <= 0) return 0;
  return Math.round((1 - YEARLY_AMOUNT / full) * 100);
}

export function yearlySavingsLabel(): string {
  const full = MONTHLY_AMOUNT * 12;
  const saved = Math.round(full - YEARLY_AMOUNT);
  return `Save $${saved} vs 12× monthly`;
}
