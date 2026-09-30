import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimedPurchaseInterval,
  purchaseIntervalToQueue,
} from "./purchase-event";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("purchaseIntervalToQueue", () => {
  it("queues a new active monthly subscription", () => {
    vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
    vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
    expect(
      purchaseIntervalToQueue({
        eventType: "subscription.created",
        status: "active",
        plan: "pro",
        previousPriceId: null,
        nextPriceId: "pri_month",
      }),
    ).toBe("monthly");
  });

  it("queues a switch from monthly to yearly", () => {
    vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
    vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
    expect(
      purchaseIntervalToQueue({
        eventType: "subscription.updated",
        status: "active",
        plan: "pro",
        previousPriceId: "pri_month",
        nextPriceId: "pri_year",
      }),
    ).toBe("yearly");
  });

  it("does not queue a renewal of the same price", () => {
    vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
    vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
    expect(
      purchaseIntervalToQueue({
        eventType: "subscription.updated",
        status: "active",
        plan: "pro",
        previousPriceId: "pri_month",
        nextPriceId: "pri_month",
      }),
    ).toBeNull();
  });

  it("does not queue a canceled subscription", () => {
    vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
    vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
    expect(
      purchaseIntervalToQueue({
        eventType: "subscription.canceled",
        status: "canceled",
        plan: "free",
        previousPriceId: "pri_month",
        nextPriceId: "pri_month",
      }),
    ).toBeNull();
  });
});

describe("claimedPurchaseInterval", () => {
  it("accepts monthly and yearly only", () => {
    expect(claimedPurchaseInterval("monthly")).toBe("monthly");
    expect(claimedPurchaseInterval("yearly")).toBe("yearly");
    expect(claimedPurchaseInterval(null)).toBeNull();
    expect(claimedPurchaseInterval("weekly")).toBeNull();
  });
});
