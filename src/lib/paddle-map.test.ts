import { describe, expect, it, vi } from "vitest";

vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");
vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_MONTHLY", "pri_bifocal_m");

import { mapPaddleSubscription } from "./paddle-map";

const base = {
  id: "sub_1",
  status: "active",
  customerId: "ctm_1",
  customData: { userId: "user_1" },
  currentBillingPeriod: { endsAt: "2026-09-24T00:00:00.000Z" },
  items: [{ price: { id: "pri_month" } }],
  scheduledChange: null as { action?: string } | null,
};

describe("mapPaddleSubscription", () => {
  it("maps active monthly to pro", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: base,
    });
    expect(row?.plan).toBe("pro");
    expect(row?.userId).toBe("user_1");
    expect(row?.paddlePriceId).toBe("pri_month");
    expect(row?.cancelAtPeriodEnd).toBe(false);
  });

  it("sets cancelAtPeriodEnd when scheduled cancel", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: {
        ...base,
        scheduledChange: { action: "cancel" },
      },
    });
    expect(row?.cancelAtPeriodEnd).toBe(true);
    expect(row?.plan).toBe("pro");
  });

  it("returns null when price is not Pro", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: { ...base, items: [{ price: { id: "pri_other" } }] },
    });
    expect(row).toBeNull();
  });

  it("leaves legacy subscriptions without a selection", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: base,
    });
    expect(row?.extensions).toBeNull();
  });

  it("stores the extensions picked at checkout, dropping unknown names", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: {
        ...base,
        customData: { userId: "user_1", extensions: ["indeed", "glassdoor", "linkedin"] },
        items: [{ price: { id: "pri_bifocal_m" } }],
      },
    });
    expect(row?.paddlePriceId).toBe("pri_bifocal_m");
    expect(row?.extensions).toEqual(["indeed", "linkedin"]);
  });

  it("returns null when userId is missing", () => {
    const row = mapPaddleSubscription({
      occurredAt: "2026-08-24T00:00:00.000Z",
      data: { ...base, customData: {} },
    });
    expect(row).toBeNull();
  });
});
