import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const ATS_QUOTA_MODULE = "./ats-quota";
const pgDialect = new PgDialect();
type UsageConflictContract = ReturnType<
  typeof import("./ats-quota").buildAtsUsageConflict
>;

type UsageRow = {
  userId: string;
  periodKey: string;
  periodEnd: Date;
  used: number;
  createdAt: Date;
  updatedAt: Date;
};

function createQuotaDb(options: {
  returningRows: UsageRow[];
  selectedRows?: UsageRow[];
}) {
  const state = {
    values: null as Record<string, unknown> | null,
    conflictConfig: null as UsageConflictContract | null,
    selectCalls: 0,
  };

  return {
    state,
    insert() {
      return {
        values(values: Record<string, unknown>) {
          state.values = values;
          return {
            onConflictDoUpdate(config: UsageConflictContract) {
              state.conflictConfig = config;
              return {
                returning: async () => options.returningRows,
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => {
                  state.selectCalls += 1;
                  return options.selectedRows ?? [];
                },
              };
            },
          };
        },
      };
    },
  };
}

async function loadQuotaModule() {
  return import(ATS_QUOTA_MODULE);
}

function renderSql(value: unknown) {
  return pgDialect.sqlToQuery(value as never);
}

describe("reserveAtsUsage", () => {
  it("builds the atomic conflict contract from actual drizzle sql objects", async () => {
    const quota = await loadQuotaModule();
    expect(typeof quota.buildAtsUsageConflict).toBe("function");

    const contract = quota.buildAtsUsageConflict(
      3,
      new Date("2026-09-17T00:00:00.000Z"),
    );
    const usageTable = schema.atsUsage;

    expect(contract.target).toEqual([usageTable.userId, usageTable.periodKey]);
    expect(contract).not.toHaveProperty("increment");
    expect(contract).not.toHaveProperty("guard");

    expect(renderSql(contract.set.used)).toMatchObject({
      sql: '"ats_cloud_usage"."used" + 1',
      params: [],
    });
    expect(renderSql(contract.setWhere)).toMatchObject({
      sql: '"ats_cloud_usage"."used" < $1',
      params: [3],
    });
  });

  it("creates first usage row for the current subscription period", async () => {
    const { buildAtsUsageConflict, reserveAtsUsage } =
      await loadQuotaModule();
    const periodEnd = "2026-10-01T00:00:00.000Z";
    const row: UsageRow = {
      userId: "user_123",
      periodKey: periodEnd,
      periodEnd: new Date(periodEnd),
      used: 1,
      createdAt: new Date("2026-09-17T00:00:00.000Z"),
      updatedAt: new Date("2026-09-17T00:00:00.000Z"),
    };
    const db = createQuotaDb({ returningRows: [row] });

    const result = await reserveAtsUsage({
      userId: "user_123",
      periodEnd,
      limit: 3,
      db: db as never,
    });

    expect(db.state.values).toMatchObject({
      userId: "user_123",
      periodKey: periodEnd,
      periodEnd: row.periodEnd,
      used: 1,
    });
    const expectedConflict = buildAtsUsageConflict(
      3,
      db.state.values?.updatedAt as Date,
    );
    expect(db.state.conflictConfig?.target).toEqual(expectedConflict.target);
    expect(renderSql(db.state.conflictConfig?.set?.used)).toMatchObject({
      sql: '"ats_cloud_usage"."used" + 1',
      params: [],
    });
    expect(renderSql(db.state.conflictConfig?.setWhere)).toMatchObject({
      sql: '"ats_cloud_usage"."used" < $1',
      params: [3],
    });
    expect(result).toEqual({
      allowed: true,
      used: 1,
      limit: 3,
      remaining: 2,
      periodEnd,
    });
  });

  it("returns the exhausted period usage when atomic upsert updates no rows", async () => {
    const { reserveAtsUsage } = await loadQuotaModule();
    const periodEnd = "2026-10-01T00:00:00.000Z";
    const row: UsageRow = {
      userId: "user_123",
      periodKey: periodEnd,
      periodEnd: new Date(periodEnd),
      used: 3,
      createdAt: new Date("2026-09-17T00:00:00.000Z"),
      updatedAt: new Date("2026-09-17T00:00:00.000Z"),
    };
    const db = createQuotaDb({ returningRows: [], selectedRows: [row] });

    const result = await reserveAtsUsage({
      userId: "user_123",
      periodEnd: new Date(periodEnd),
      limit: 3,
      db: db as never,
    });

    expect(db.state.selectCalls).toBe(1);
    expect(result).toEqual({
      allowed: false,
      used: 3,
      limit: 3,
      remaining: 0,
      periodEnd,
    });
  });
});
