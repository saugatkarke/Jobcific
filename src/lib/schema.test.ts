import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("better-auth schema compatibility", () => {
  it("includes issuer column on account table", () => {
    const columns = getTableColumns(schema.account);
    expect(columns.issuer).toBeDefined();
  });
});

describe("ATS usage schema", () => {
  it("tracks usage by user and subscription period end", () => {
    expect(schema.atsUsage).toBeDefined();

    const columns = getTableColumns(schema.atsUsage);
    expect(columns.userId).toBeDefined();
    expect(columns.periodKey).toBeDefined();
    expect(columns.periodEnd).toBeDefined();
    expect(columns.used).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("tracks one-time cloud claims by reservation identifier", () => {
    const columns = getTableColumns(schema.atsScoreReservationUse);
    expect(columns.reservationId).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.claimedAt).toBeDefined();
  });
});
