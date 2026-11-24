import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimedPurchase, purchaseToQueue } from "./purchase-event";

beforeEach(() => {
  vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
  vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_QUARTERLY", "pri_bifocal_q");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("purchaseToQueue", () => {
  it("queues the price of a new active subscription", () => {
    expect(
      purchaseToQueue({
        eventType: "subscription.created",
        status: "active",
        plan: "pro",
        previousPriceId: null,
        nextPriceId: "pri_bifocal_q",
      }),
    ).toBe("pri_bifocal_q");
  });

  it("queues a switch to a different price", () => {
    expect(
      purchaseToQueue({
        eventType: "subscription.updated",
        status: "active",
        plan: "pro",
        previousPriceId: "pri_month",
        nextPriceId: "pri_year",
      }),
    ).toBe("pri_year");
  });

  it("does not queue a renewal of the same price", () => {
    expect(
      purchaseToQueue({
        eventType: "subscription.updated",
        status: "active",
        plan: "pro",
        previousPriceId: "pri_month",
        nextPriceId: "pri_month",
      }),
    ).toBeNull();
  });

  it("does not queue a canceled subscription", () => {
    expect(
      purchaseToQueue({
        eventType: "subscription.canceled",
        status: "canceled",
        plan: "free",
        previousPriceId: "pri_month",
        nextPriceId: "pri_month",
      }),
    ).toBeNull();
  });
});

describe("claimedPurchase", () => {
  it("reports the plan, interval, and price of a queued price ID", () => {
    expect(claimedPurchase("pri_bifocal_q")).toEqual({
      interval: "quarterly",
      plan: "bifocal",
      value: 17.99,
    });
  });

  it("still reads values queued before plans existed", () => {
    expect(claimedPurchase("monthly")).toEqual({
      interval: "monthly",
      plan: "bifocal",
      value: 4.99,
    });
    expect(claimedPurchase("yearly")).toEqual({
      interval: "yearly",
      plan: "bifocal",
      value: 39,
    });
  });

  it("ignores empty or unknown values", () => {
    expect(claimedPurchase(null)).toBeNull();
    expect(claimedPurchase("weekly")).toBeNull();
  });
});
