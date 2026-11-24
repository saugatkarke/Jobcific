import { describe, expect, it, vi } from "vitest";
import {
  emptyEntitlement,
  entitledExtensions,
  isClientEntitled,
  resolveEntitlement,
} from "./entitlement";

const now = Date.parse("2026-08-24T00:00:00.000Z");

describe("resolveEntitlement", () => {
  it("is free when row is null", () => {
    expect(resolveEntitlement(null, now)).toEqual(emptyEntitlement());
  });

  it("is pro when active", () => {
    const r = resolveEntitlement(
      {
        plan: "pro",
        status: "active",
        currentPeriodEnd: "2026-09-24T00:00:00.000Z",
      },
      now,
    );
    expect(r.plan).toBe("pro");
    expect(r.features.hideJobs).toBe(true);
    expect(r.features.atsResults).toBe(true);
  });

  it("is pro when trialing", () => {
    expect(
      resolveEntitlement(
        { plan: "pro", status: "trialing", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        now,
      ).plan,
    ).toBe("pro");
  });

  it("is pro when past_due", () => {
    expect(
      resolveEntitlement(
        { plan: "pro", status: "past_due", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        now,
      ).plan,
    ).toBe("pro");
  });

  it("is pro when canceled but period has not ended", () => {
    expect(
      resolveEntitlement(
        { plan: "pro", status: "canceled", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        now,
      ).plan,
    ).toBe("pro");
  });

  it("is free when canceled and period ended", () => {
    expect(
      resolveEntitlement(
        { plan: "pro", status: "canceled", currentPeriodEnd: "2026-08-01T00:00:00.000Z" },
        now,
      ).plan,
    ).toBe("free");
  });

  it("is free when paused", () => {
    expect(
      resolveEntitlement(
        { plan: "pro", status: "paused", currentPeriodEnd: "2026-09-01T00:00:00.000Z" },
        now,
      ).plan,
    ).toBe("free");
  });
});

describe("entitledExtensions", () => {
  vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_legacy");
  vi.stubEnv("PADDLE_PRICE_ID_LENS_MONTHLY", "pri_lens");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_MONTHLY", "pri_bifocal");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_MONTHLY", "pri_panorama");

  const pro = resolveEntitlement(
    { plan: "pro", status: "active", currentPeriodEnd: "2026-09-24T00:00:00.000Z" },
    now,
  );

  it("is empty for a free account", () => {
    expect(
      entitledExtensions(emptyEntitlement(), {
        paddlePriceId: "pri_panorama",
        extensions: null,
      }),
    ).toEqual([]);
    expect(entitledExtensions(pro, null)).toEqual([]);
  });

  it("covers Indeed and Seek on the legacy price", () => {
    expect(entitledExtensions(pro, { paddlePriceId: "pri_legacy", extensions: null })).toEqual([
      "indeed",
      "seek",
    ]);
  });

  it("covers every extension on Panorama", () => {
    expect(entitledExtensions(pro, { paddlePriceId: "pri_panorama", extensions: [] })).toEqual([
      "indeed",
      "linkedin",
      "seek",
    ]);
  });

  it("covers the stored picks on Lens and Bifocal", () => {
    expect(
      entitledExtensions(pro, { paddlePriceId: "pri_lens", extensions: ["linkedin"] }),
    ).toEqual(["linkedin"]);
    expect(
      entitledExtensions(pro, {
        paddlePriceId: "pri_bifocal",
        extensions: ["indeed", "linkedin"],
      }),
    ).toEqual(["indeed", "linkedin"]);
  });

  it("never grants more than the plan allows or unknown names", () => {
    expect(
      entitledExtensions(pro, {
        paddlePriceId: "pri_lens",
        extensions: ["glassdoor", "seek", "indeed"],
      }),
    ).toEqual(["seek"]);
    expect(entitledExtensions(pro, { paddlePriceId: "pri_bifocal", extensions: null })).toEqual(
      [],
    );
  });
});

describe("isClientEntitled", () => {
  it("allows an extension included in the plan", () => {
    expect(isClientEntitled("seek", ["seek", "indeed"])).toBe(true);
  });

  it("rejects an extension outside the plan", () => {
    expect(isClientEntitled("linkedin", ["seek", "indeed"])).toBe(false);
  });

  it("allows a legacy token only when the plan covers Seek and Indeed", () => {
    expect(isClientEntitled(null, ["seek", "indeed"])).toBe(true);
    expect(isClientEntitled(null, ["seek", "linkedin"])).toBe(false);
    expect(isClientEntitled(null, [])).toBe(false);
  });
});
