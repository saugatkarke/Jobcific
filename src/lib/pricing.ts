export const PRODUCT_NAME = "Jobcific Pro";

export type PlanId = "lens" | "bifocal" | "panorama";
/* Yearly is legacy only; new checkouts are monthly or quarterly. */
export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type CheckoutInterval = Exclude<BillingInterval, "yearly">;

export type Plan = {
  id: PlanId;
  name: string;
  extensionCount: 1 | 2 | 3;
  monthly: number;
  quarterly: number;
};

export const PLANS: readonly Plan[] = [
  { id: "lens", name: "Lens", extensionCount: 1, monthly: 4.99, quarterly: 9.99 },
  { id: "bifocal", name: "Bifocal", extensionCount: 2, monthly: 8.99, quarterly: 17.99 },
  { id: "panorama", name: "Panorama", extensionCount: 3, monthly: 11.99, quarterly: 23.99 },
];

export const LEGACY_MONTHLY_AMOUNT = 4.99;
export const LEGACY_YEARLY_AMOUNT = 39;

export type PriceInfo = {
  priceId: string;
  plan: PlanId;
  interval: BillingInterval;
  amount: number;
  legacy: boolean;
};

export type PlanPriceIds = Record<PlanId, Record<CheckoutInterval, string>>;

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

export function planPriceIds(): PlanPriceIds {
  return {
    lens: {
      monthly: env("PADDLE_PRICE_ID_LENS_MONTHLY"),
      quarterly: env("PADDLE_PRICE_ID_LENS_QUARTERLY"),
    },
    bifocal: {
      monthly: env("PADDLE_PRICE_ID_BIFOCAL_MONTHLY"),
      quarterly: env("PADDLE_PRICE_ID_BIFOCAL_QUARTERLY"),
    },
    panorama: {
      monthly: env("PADDLE_PRICE_ID_PANORAMA_MONTHLY"),
      quarterly: env("PADDLE_PRICE_ID_PANORAMA_QUARTERLY"),
    },
  };
}

export function planById(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id)!;
}

function priceTable(): PriceInfo[] {
  const ids = planPriceIds();
  const rows: PriceInfo[] = PLANS.flatMap((plan) =>
    (["monthly", "quarterly"] as const).map((interval) => ({
      priceId: ids[plan.id][interval],
      plan: plan.id,
      interval,
      amount: plan[interval],
      legacy: false,
    })),
  );
  rows.push(
    {
      priceId: env("PADDLE_PRICE_ID_MONTHLY"),
      plan: "bifocal",
      interval: "monthly",
      amount: LEGACY_MONTHLY_AMOUNT,
      legacy: true,
    },
    {
      priceId: env("PADDLE_PRICE_ID_YEARLY"),
      plan: "bifocal",
      interval: "yearly",
      amount: LEGACY_YEARLY_AMOUNT,
      legacy: true,
    },
  );
  return rows.filter((row) => row.priceId);
}

export function priceInfo(priceId: string | null | undefined): PriceInfo | null {
  const id = String(priceId || "").trim();
  if (!id) return null;
  return priceTable().find((row) => row.priceId === id) ?? null;
}

export function isProPriceId(priceId: string): boolean {
  return priceInfo(priceId) !== null;
}

export function isCheckoutPriceId(priceId: string): boolean {
  const info = priceInfo(priceId);
  return Boolean(info && !info.legacy);
}

export function intervalFromPriceId(priceId: string): BillingInterval | null {
  return priceInfo(priceId)?.interval ?? null;
}

export function monthsInInterval(interval: BillingInterval): number {
  if (interval === "quarterly") return 3;
  if (interval === "yearly") return 12;
  return 1;
}

export function formatPrice(amount: number): string {
  if (Number.isInteger(amount)) return `$${amount}`;
  return `$${amount.toFixed(2)}`;
}

export function quarterlyDiscountPercent(plan: Plan): number {
  const full = plan.monthly * 3;
  if (full <= 0) return 0;
  return Math.round((1 - plan.quarterly / full) * 100);
}

export function planPriceLabel(plan: Plan): string {
  return `${plan.name} ${formatPrice(plan.monthly)} / month or ${formatPrice(plan.quarterly)} / quarter`;
}

export type CurrentPlan = {
  plan: PlanId;
  legacy: boolean;
  extensions: readonly string[];
} | null;

/* One pick is Lens, two Bifocal, three Panorama. Zero shows Lens as the starting price. */
export function planForPickCount(count: number): Plan {
  return PLANS.find((plan) => plan.extensionCount === count) ?? PLANS[0];
}

export type ProCardCta = {
  label: string;
  disabled: boolean;
  showLegal: boolean;
};

export function proCardCta({
  current,
  picked,
  pending = false,
}: {
  current: CurrentPlan;
  picked: number;
  pending?: boolean;
}): ProCardCta {
  if (current) return { label: "Current plan", disabled: true, showLegal: false };
  if (picked < 1) {
    return { label: "Pick an extension", disabled: true, showLegal: true };
  }
  return {
    label: pending ? "Subscribing..." : "Subscribe",
    disabled: pending,
    showLegal: true,
  };
}
