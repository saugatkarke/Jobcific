import { describe, expect, it, vi } from "vitest";
import { proBillingIntervalFromRow } from "./session-entitlement";

vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");

describe("proBillingIntervalFromRow", () => {
  it("returns monthly for an active monthly Pro subscription", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        paddlePriceId: "pri_month",
      }),
    ).toBe("monthly");
  });

  it("returns yearly for an active yearly Pro subscription", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        paddlePriceId: "pri_year",
      }),
    ).toBe("yearly");
  });

  it("returns null when the plan is no longer Pro", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "canceled",
        currentPeriodEnd: new Date(Date.now() - 86400000),
        paddlePriceId: "pri_year",
      }),
    ).toBeNull();
  });
});
