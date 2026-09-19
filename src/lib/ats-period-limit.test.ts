import { afterEach, describe, expect, it } from "vitest";
import { atsPeriodLimit } from "./ats-period-limit";

describe("atsPeriodLimit", () => {
  afterEach(() => {
    delete process.env.ATS_PERIOD_LIMIT;
    delete process.env.ATS_CLOUD_PERIOD_LIMIT;
  });

  it("defaults to 1000", () => {
    expect(atsPeriodLimit()).toBe(1000);
  });

  it("prefers ATS_PERIOD_LIMIT over the legacy setting", () => {
    process.env.ATS_PERIOD_LIMIT = "250";
    process.env.ATS_CLOUD_PERIOD_LIMIT = "500";
    expect(atsPeriodLimit()).toBe(250);
  });

  it("temporarily supports ATS_CLOUD_PERIOD_LIMIT", () => {
    process.env.ATS_CLOUD_PERIOD_LIMIT = "400";
    expect(atsPeriodLimit()).toBe(400);
  });

  it("falls back for invalid values and truncates valid decimals", () => {
    process.env.ATS_PERIOD_LIMIT = "invalid";
    expect(atsPeriodLimit()).toBe(1000);
    process.env.ATS_PERIOD_LIMIT = "25.9";
    expect(atsPeriodLimit()).toBe(25);
  });
});
