import { NextRequest, NextResponse } from "next/server";
import { atsPeriodLimit } from "@/lib/ats-period-limit";
import { reserveAtsUsage } from "@/lib/ats-quota";
import { signAtsReservation } from "@/lib/ats-reservation";
import { resolveEntitlement } from "@/lib/entitlement";
import {
  extensionClaimsFromRequest,
  latestSubscriptionRow,
} from "@/lib/session-entitlement";

const ERROR_STATUS = {
  AUTH_REQUIRED: 401,
  PRO_REQUIRED: 403,
  INVALID_INPUT: 400,
  SUBSCRIPTION_LIMIT: 429,
  INTERNAL_ERROR: 500,
} as const;

type ErrorCode = keyof typeof ERROR_STATUS;

function errorResponse(error: ErrorCode, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error, ...(extra || {}) },
    { status: ERROR_STATUS[error] },
  );
}

function jobIdFromBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_INPUT");
  }
  const value = (body as { jobId?: unknown }).jobId;
  if (typeof value !== "string") throw new Error("INVALID_INPUT");
  const jobId = value.trim();
  if (!jobId || jobId.length > 256) throw new Error("INVALID_INPUT");
  return jobId;
}

function publicCode(error: unknown): ErrorCode {
  const code = error instanceof Error ? error.message : "";
  return code === "INVALID_INPUT" ? code : "INTERNAL_ERROR";
}

export async function POST(req: NextRequest) {
  let claims;
  try {
    claims = await extensionClaimsFromRequest(req);
  } catch {
    return errorResponse("INTERNAL_ERROR");
  }
  if (!claims) return errorResponse("AUTH_REQUIRED");

  let row;
  try {
    row = await latestSubscriptionRow(claims.sub);
  } catch {
    return errorResponse("INTERNAL_ERROR");
  }
  const resolved = resolveEntitlement(
    row
      ? {
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
        }
      : null,
  );
  const periodEnd = row?.currentPeriodEnd
    ? new Date(row.currentPeriodEnd)
    : null;
  if (
    resolved.plan !== "pro" ||
    !resolved.features.atsResults ||
    !periodEnd ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return errorResponse("PRO_REQUIRED");
  }

  let jobId;
  try {
    jobId = jobIdFromBody(await req.json().catch(() => null));
  } catch (error) {
    return errorResponse(publicCode(error));
  }

  try {
    const allowance = await reserveAtsUsage({
      userId: claims.sub,
      periodEnd,
      limit: atsPeriodLimit(),
    });
    const publicAllowance = {
      limit: allowance.limit,
      used: allowance.used,
      remaining: allowance.remaining,
      periodEnd: allowance.periodEnd,
    };
    if (!allowance.allowed) {
      return errorResponse("SUBSCRIPTION_LIMIT", {
        allowance: publicAllowance,
      });
    }
    const reservationToken = await signAtsReservation({
      userId: claims.sub,
      jobId,
    });
    return NextResponse.json({ reservationToken, allowance: publicAllowance });
  } catch {
    return errorResponse("INTERNAL_ERROR");
  }
}
