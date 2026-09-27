import { describe, expect, it } from "vitest";
import {
  CHECKOUT_PENDING_NOTICE,
  checkoutNotice,
  needsEntitlementFetch,
  planStatusLabel,
} from "./account-entitlement";

const pro = { plan: "pro" as const, status: "active" };
const free = { plan: "free" as const, status: "none" };

describe("needsEntitlementFetch", () => {
  it("fetches when the server could not provide an entitlement", () => {
    expect(needsEntitlementFetch(false, null)).toBe(true);
    expect(needsEntitlementFetch(true, null)).toBe(true);
  });

  it("trusts the server entitlement on a normal visit", () => {
    expect(needsEntitlementFetch(false, free)).toBe(false);
    expect(needsEntitlementFetch(false, pro)).toBe(false);
  });

  it("keeps polling after checkout until Pro lands", () => {
    expect(needsEntitlementFetch(true, free)).toBe(true);
    expect(needsEntitlementFetch(true, pro)).toBe(false);
  });
});

describe("checkoutNotice", () => {
  it("shows the pending notice after checkout until Pro is active", () => {
    expect(checkoutNotice(true, null)).toBe(CHECKOUT_PENDING_NOTICE);
    expect(checkoutNotice(true, free)).toBe(CHECKOUT_PENDING_NOTICE);
    expect(checkoutNotice(true, pro)).toBe("");
  });

  it("stays empty outside checkout", () => {
    expect(checkoutNotice(false, null)).toBe("");
    expect(checkoutNotice(false, free)).toBe("");
  });
});

describe("planStatusLabel", () => {
  it("adds the billing interval to an active Pro plan", () => {
    expect(planStatusLabel({ ...pro, interval: "monthly" })).toBe("active monthly");
    expect(planStatusLabel({ ...pro, interval: "yearly" })).toBe("active yearly");
  });

  it("falls back to the bare status when the interval is unknown", () => {
    expect(planStatusLabel(pro)).toBe("active");
    expect(planStatusLabel({ ...pro, status: "none", interval: null })).toBe("active");
  });

  it("labels every Free plan as free plan, without an interval", () => {
    expect(planStatusLabel(free)).toBe("free plan");
    expect(planStatusLabel({ ...free, interval: "monthly" })).toBe("free plan");
    expect(planStatusLabel({ ...free, status: "canceled" })).toBe("free plan");
  });
});
