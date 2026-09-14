import { describe, expect, it, vi } from "vitest";
import {
  MONTHLY_AMOUNT,
  YEARLY_AMOUNT,
  canStartCheckout,
  defaultPricingInterval,
  formatPrice,
  intervalFromPriceId,
  pricingCardOrder,
  pricingIntervalTabs,
  pricingProCta,
  yearlyDiscountPercent,
} from "./pricing";

vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");

describe("pricing display helpers", () => {
  it("formats whole dollars without decimals", () => {
    expect(formatPrice(YEARLY_AMOUNT)).toBe("$39");
  });

  it("keeps cents on monthly", () => {
    expect(formatPrice(MONTHLY_AMOUNT)).toBe("$4.99");
  });

  it("rounds yearly savings to a percent badge", () => {
    expect(yearlyDiscountPercent()).toBe(35);
  });
});

describe("pro pricing CTA", () => {
  it("maps Paddle price IDs to billing intervals", () => {
    expect(intervalFromPriceId("pri_month")).toBe("monthly");
    expect(intervalFromPriceId("pri_year")).toBe("yearly");
    expect(intervalFromPriceId("pri_other")).toBeNull();
  });

  it("opens the yearly tab for monthly subscribers", () => {
    expect(defaultPricingInterval("monthly")).toBe("yearly");
  });

  it("stays on yearly for yearly subscribers and monthly for everyone else", () => {
    expect(defaultPricingInterval("yearly")).toBe("yearly");
    expect(defaultPricingInterval(null)).toBe("monthly");
  });

  it("keeps Monthly selected for logged-in free users", () => {
    expect(defaultPricingInterval(null)).toBe("monthly");
  });

  it("puts Free first for logged-out visitors and Pro first when logged in", () => {
    expect(pricingCardOrder(false)).toEqual(["free", "pro"]);
    expect(pricingCardOrder(true)).toEqual(["pro", "free"]);
  });

  it("puts Yearly first only for monthly subscribers", () => {
    expect(pricingIntervalTabs(null)).toEqual(["monthly", "yearly"]);
    expect(pricingIntervalTabs("yearly")).toEqual(["monthly", "yearly"]);
    expect(pricingIntervalTabs("monthly")).toEqual(["yearly", "monthly"]);
  });

  it("disables the current plan with Subscribed", () => {
    expect(pricingProCta({ subscribedInterval: "monthly", selectedInterval: "monthly" })).toEqual({
      label: "Subscribed",
      disabled: true,
      showLegal: false,
    });
    expect(pricingProCta({ subscribedInterval: "yearly", selectedInterval: "yearly" })).toEqual({
      label: "Subscribed",
      disabled: true,
      showLegal: false,
    });
  });

  it("keeps yearly checkout available for monthly subscribers", () => {
    expect(pricingProCta({ subscribedInterval: "monthly", selectedInterval: "yearly" })).toEqual({
      label: "Subscribe",
      disabled: false,
      showLegal: true,
    });
  });

  it("keeps yearly subscribers subscribed even on the monthly tab", () => {
    expect(pricingProCta({ subscribedInterval: "yearly", selectedInterval: "monthly" })).toEqual({
      label: "Subscribed",
      disabled: true,
      showLegal: false,
    });
  });

  it("blocks checkout for the current plan and any yearly subscriber", () => {
    expect(canStartCheckout(null, "monthly")).toBe(true);
    expect(canStartCheckout("monthly", "yearly")).toBe(true);
    expect(canStartCheckout("monthly", "monthly")).toBe(false);
    expect(canStartCheckout("yearly", "yearly")).toBe(false);
    expect(canStartCheckout("yearly", "monthly")).toBe(false);
  });

  it("shows Starting when checkout is pending", () => {
    expect(
      pricingProCta({
        subscribedInterval: null,
        selectedInterval: "monthly",
        pending: true,
      }),
    ).toEqual({
      label: "Starting…",
      disabled: true,
      showLegal: true,
    });
  });
});
