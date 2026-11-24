import { describe, expect, it, vi } from "vitest";
import {
  PLANS,
  formatPrice,
  intervalFromPriceId,
  isCheckoutPriceId,
  isProPriceId,
  monthsInInterval,
  planById,
  planForPickCount,
  priceInfo,
  proCardCta,
  quarterlyDiscountPercent,
} from "./pricing";

vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_legacy_month");
vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_legacy_year");
vi.stubEnv("PADDLE_PRICE_ID_LENS_MONTHLY", "pri_lens_m");
vi.stubEnv("PADDLE_PRICE_ID_LENS_QUARTERLY", "pri_lens_q");
vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_MONTHLY", "pri_bifocal_m");
vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_QUARTERLY", "pri_bifocal_q");
vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_MONTHLY", "pri_panorama_m");
vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_QUARTERLY", "pri_panorama_q");

describe("plans", () => {
  it("prices Lens, Bifocal, and Panorama", () => {
    expect(PLANS.map((plan) => [plan.name, plan.extensionCount, plan.monthly, plan.quarterly])).toEqual([
      ["Lens", 1, 4.99, 9.99],
      ["Bifocal", 2, 8.99, 17.99],
      ["Panorama", 3, 11.99, 23.99],
    ]);
  });

  it("discounts every quarterly price by about a third", () => {
    for (const plan of PLANS) expect(quarterlyDiscountPercent(plan)).toBe(33);
  });

  it("formats prices", () => {
    expect(formatPrice(39)).toBe("$39");
    expect(formatPrice(4.99)).toBe("$4.99");
  });
});

describe("priceInfo", () => {
  it("maps new prices to their plan and interval", () => {
    expect(priceInfo("pri_bifocal_q")).toEqual({
      priceId: "pri_bifocal_q",
      plan: "bifocal",
      interval: "quarterly",
      amount: 17.99,
      legacy: false,
    });
    expect(intervalFromPriceId("pri_lens_m")).toBe("monthly");
  });

  it("maps legacy prices to Bifocal", () => {
    expect(priceInfo("pri_legacy_month")).toMatchObject({
      plan: "bifocal",
      interval: "monthly",
      amount: 4.99,
      legacy: true,
    });
    expect(priceInfo("pri_legacy_year")).toMatchObject({ interval: "yearly", legacy: true });
  });

  it("allows checkout only on new prices", () => {
    expect(isProPriceId("pri_legacy_month")).toBe(true);
    expect(isCheckoutPriceId("pri_legacy_month")).toBe(false);
    expect(isCheckoutPriceId("pri_panorama_m")).toBe(true);
    expect(isProPriceId("pri_other")).toBe(false);
    expect(priceInfo("")).toBeNull();
  });

  it("counts months per billing interval", () => {
    expect(monthsInInterval("monthly")).toBe(1);
    expect(monthsInInterval("quarterly")).toBe(3);
    expect(monthsInInterval("yearly")).toBe(12);
  });
});

describe("planForPickCount", () => {
  it("names the plan from the number of extensions picked", () => {
    expect(planForPickCount(1).id).toBe("lens");
    expect(planForPickCount(2).id).toBe("bifocal");
    expect(planForPickCount(3).id).toBe("panorama");
  });

  it("shows Lens as the starting price before anything is picked", () => {
    expect(planForPickCount(0)).toBe(planById("lens"));
  });
});

describe("proCardCta", () => {
  it("asks for an extension before checkout", () => {
    expect(proCardCta({ current: null, picked: 0 })).toEqual({
      label: "Pick an extension",
      disabled: true,
      showLegal: true,
    });
    expect(proCardCta({ current: null, picked: 2 })).toEqual({
      label: "Subscribe",
      disabled: false,
      showLegal: true,
    });
  });

  it("shows Subscribing while checkout opens", () => {
    expect(proCardCta({ current: null, picked: 1, pending: true })).toEqual({
      label: "Subscribing...",
      disabled: true,
      showLegal: true,
    });
  });

  it("locks the card on the current plan for subscribers", () => {
    const current = { plan: "bifocal" as const, legacy: true, extensions: ["seek", "indeed"] };
    expect(proCardCta({ current, picked: 2 })).toEqual({
      label: "Current plan",
      disabled: true,
      showLegal: false,
    });
  });
});
