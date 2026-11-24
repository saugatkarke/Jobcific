import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  billingModeFor,
  carryActive,
  chargeTodayFromSummary,
  scheduledChange,
  validateChange,
  withEffectivePlan,
  type PlanRow,
} from "./plan-change";

const NOW = Date.parse("2026-11-23T00:00:00Z");
const PERIOD_END = new Date("2026-12-21T00:00:00Z");

function row(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
    plan: "pro",
    status: "active",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    paddlePriceId: "pri_bifocal_m",
    extensions: ["seek", "indeed"],
    carryPriceId: null,
    carryExtensions: null,
    carryUntil: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_legacy");
  vi.stubEnv("PADDLE_PRICE_ID_LENS_MONTHLY", "pri_lens_m");
  vi.stubEnv("PADDLE_PRICE_ID_LENS_QUARTERLY", "pri_lens_q");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_MONTHLY", "pri_bifocal_m");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_QUARTERLY", "pri_bifocal_q");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_MONTHLY", "pri_panorama_m");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_QUARTERLY", "pri_panorama_q");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function check(priceId: string, extensions: unknown, overrides: Partial<PlanRow> = {}) {
  return validateChange({ row: row(overrides), priceId, extensions, nowMs: NOW });
}

describe("validateChange", () => {
  it("classifies an upgrade that keeps every current extension", () => {
    const result = check("pri_panorama_m", []);
    expect(result).toMatchObject({ ok: true, kind: "upgrade" });
    if (result.ok) expect(result.next.extensions).toHaveLength(3);
  });

  it("classifies a downgrade to a subset", () => {
    expect(check("pri_lens_m", ["indeed"])).toMatchObject({ ok: true, kind: "downgrade" });
  });

  it("classifies an interval switch, even with fewer extensions", () => {
    expect(check("pri_bifocal_q", ["seek", "indeed"])).toMatchObject({ ok: true, kind: "interval" });
    expect(check("pri_lens_q", ["seek"])).toMatchObject({ ok: true, kind: "interval" });
  });

  it("rejects swaps", () => {
    expect(check("pri_lens_m", ["linkedin"])).toEqual({ ok: false, error: "SWAP_NOT_SUPPORTED" });
    expect(check("pri_bifocal_q", ["seek", "linkedin"])).toEqual({
      ok: false,
      error: "SWAP_NOT_SUPPORTED",
    });
    expect(
      check("pri_bifocal_m", ["indeed", "linkedin"], {
        paddlePriceId: "pri_lens_m",
        extensions: ["seek"],
      }),
    ).toEqual({ ok: false, error: "SWAP_NOT_SUPPORTED" });
  });

  it("rejects the current plan", () => {
    expect(check("pri_bifocal_m", ["indeed", "seek"])).toEqual({ ok: false, error: "NO_CHANGE" });
  });

  it("treats the legacy price as Seek and Indeed and refuses a same-plan move", () => {
    const legacy = { paddlePriceId: "pri_legacy", extensions: null };
    expect(check("pri_lens_m", ["seek"], legacy)).toMatchObject({ ok: true, kind: "downgrade" });
    expect(check("pri_panorama_m", [], legacy)).toMatchObject({ ok: true, kind: "upgrade" });
    expect(check("pri_bifocal_m", ["seek", "indeed"], legacy)).toEqual({
      ok: false,
      error: "NO_CHANGE",
    });
  });

  it("validates the price and the picks", () => {
    expect(check("pri_legacy", ["seek", "indeed"])).toEqual({ ok: false, error: "INVALID_PRICE" });
    expect(check("pri_other", ["seek"])).toEqual({ ok: false, error: "INVALID_PRICE" });
    expect(check("pri_lens_m", ["seek", "indeed"])).toEqual({
      ok: false,
      error: "INVALID_EXTENSIONS",
    });
    expect(check("pri_bifocal_q", ["seek", "seek"])).toEqual({
      ok: false,
      error: "INVALID_EXTENSIONS",
    });
  });

  it.each([
    [{ plan: "free" }, "NO_SUBSCRIPTION"],
    [{ status: "past_due" }, "NOT_ACTIVE"],
    [{ cancelAtPeriodEnd: true }, "CANCEL_SCHEDULED"],
    [
      { carryPriceId: "pri_panorama_m", carryUntil: PERIOD_END, carryExtensions: null },
      "CHANGE_PENDING",
    ],
  ] as const)("blocks changes for %j", (overrides, error) => {
    expect(check("pri_lens_m", ["seek"], overrides)).toEqual({ ok: false, error });
  });
});

describe("effective plan", () => {
  const scheduled = row({
    paddlePriceId: "pri_lens_m",
    extensions: ["seek"],
    carryPriceId: "pri_panorama_m",
    carryExtensions: ["seek", "indeed", "linkedin"],
    carryUntil: PERIOD_END,
  });

  it("keeps the carried plan until carry_until", () => {
    expect(carryActive(scheduled, NOW)).toBe(true);
    expect(withEffectivePlan(scheduled, NOW)).toMatchObject({
      paddlePriceId: "pri_panorama_m",
      extensions: ["seek", "indeed", "linkedin"],
    });
    expect(scheduledChange(scheduled, NOW)).toEqual({
      planId: "lens",
      interval: "monthly",
      extensions: ["seek"],
      effectiveAt: PERIOD_END.toISOString(),
    });
  });

  it("switches to the new plan once carry_until passes", () => {
    const later = PERIOD_END.getTime() + 1;
    expect(carryActive(scheduled, later)).toBe(false);
    expect(withEffectivePlan(scheduled, later)).toMatchObject({ paddlePriceId: "pri_lens_m" });
    expect(scheduledChange(scheduled, later)).toBeNull();
  });
});

describe("billing helpers", () => {
  it("bills downgrades at renewal and everything else now", () => {
    expect(billingModeFor("downgrade")).toBe("full_next_billing_period");
    expect(billingModeFor("upgrade")).toBe("prorated_immediately");
    expect(billingModeFor("interval")).toBe("prorated_immediately");
  });

  it("reads Paddle's charge or credit in dollars", () => {
    expect(chargeTodayFromSummary({ action: "charge", amount: "340" })).toBe(3.4);
    expect(chargeTodayFromSummary({ action: "credit", amount: "125" })).toBe(-1.25);
    expect(chargeTodayFromSummary(null)).toBe(0);
  });
});
