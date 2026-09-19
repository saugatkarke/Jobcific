import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { atsUsage } from "./schema";

type UsageRow = {
  userId: string;
  periodKey: string;
  periodEnd: Date;
  used: number;
  createdAt: Date;
  updatedAt: Date;
};

type ReserveAtsCloudUsageDb = {
  insert: ReturnType<typeof getDb>["insert"];
  select: ReturnType<typeof getDb>["select"];
};

export type ReserveAtsUsageInput = {
  userId: string;
  periodEnd: string | Date;
  limit: number;
  db?: ReserveAtsCloudUsageDb;
};

export type AtsUsageReservation = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodEnd: string;
};

function normalizePeriodEnd(value: string | Date): { date: Date; key: string } {
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_PERIOD_END");
  }
  return { date, key: date.toISOString() };
}

function normalizeLimit(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("INVALID_LIMIT");
  }
  return Math.max(0, Math.trunc(value));
}

function reservationResult(
  allowed: boolean,
  used: number,
  limit: number,
  periodEnd: string,
): AtsUsageReservation {
  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodEnd,
  };
}

export function buildAtsUsageConflict(limit: number, updatedAt: Date) {
  return {
    target: [atsUsage.userId, atsUsage.periodKey],
    set: {
      used: sql`${atsUsage.used} + 1`,
      updatedAt,
    },
    setWhere: sql`${atsUsage.used} < ${limit}`,
  };
}

export async function reserveAtsUsage(
  input: ReserveAtsUsageInput,
): Promise<AtsUsageReservation> {
  const userId = String(input.userId || "").trim();
  if (!userId) {
    throw new Error("INVALID_USER_ID");
  }

  const limit = normalizeLimit(input.limit);
  const { date: periodEndDate, key: periodKey } = normalizePeriodEnd(input.periodEnd);
  if (limit < 1) {
    return reservationResult(false, 0, limit, periodKey);
  }

  const db = input.db ?? getDb();
  const now = new Date();
  const rows = (await db
    .insert(atsUsage)
    .values({
      userId,
      periodKey,
      periodEnd: periodEndDate,
      used: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate(buildAtsUsageConflict(limit, now))
    .returning()) as UsageRow[];

  const row = rows[0];
  if (row) {
    return reservationResult(true, row.used, limit, periodKey);
  }

  const existingRows = (await db
    .select()
    .from(atsUsage)
    .where(
      and(
        eq(atsUsage.userId, userId),
        eq(atsUsage.periodKey, periodKey),
      ),
    )
    .limit(1)) as UsageRow[];

  return reservationResult(
    false,
    existingRows[0]?.used ?? limit,
    limit,
    periodKey,
  );
}
