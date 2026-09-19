import { NextRequest, NextResponse } from "next/server";
import { requestGeminiAts, validateAtsInput } from "@/lib/ats";
import { verifyAtsReservation } from "@/lib/ats-reservation";
import { claimAtsReservationUse } from "@/lib/ats-reservation-use";
import { extensionClaimsFromRequest } from "@/lib/session-entitlement";

/**
 * Next requires a literal route duration. The budget test keeps this value in
 * step with ATS_ROUTE_MAX_DURATION_SECONDS.
 */
export const maxDuration = 55;

const PUBLIC_ERROR_STATUS = {
  AUTH_REQUIRED: 401,
  INVALID_INPUT: 400,
  RESERVATION_INVALID: 409,
  MODEL_BUSY: 503,
  MODEL_RESPONSE_INVALID: 502,
  SERVER_MISCONFIGURED: 500,
  INTERNAL_ERROR: 500,
} as const;

type PublicErrorCode = keyof typeof PUBLIC_ERROR_STATUS;

function jsonError(error: PublicErrorCode) {
  return NextResponse.json(
    { error },
    { status: PUBLIC_ERROR_STATUS[error] },
  );
}

function isPublicErrorCode(value: string): value is PublicErrorCode {
  return value in PUBLIC_ERROR_STATUS;
}

function publicErrorCode(error: unknown): PublicErrorCode {
  if (error instanceof Error) {
    const code = String(error.message || "").trim();
    if (isPublicErrorCode(code)) return code;
  }
  return "INTERNAL_ERROR";
}

function reservationTokenFromBody(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("RESERVATION_INVALID");
  }
  const token = (body as { reservationToken?: unknown }).reservationToken;
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("RESERVATION_INVALID");
  }
  return token.trim();
}

export async function POST(req: NextRequest) {
  let claims;
  try {
    claims = await extensionClaimsFromRequest(req);
  } catch (error) {
    return jsonError(publicErrorCode(error));
  }
  if (!claims) return jsonError("AUTH_REQUIRED");

  const body = await req.json().catch(() => null);
  let input;
  try {
    input = validateAtsInput(body);
  } catch (error) {
    return jsonError(publicErrorCode(error));
  }

  try {
    const reservationToken = reservationTokenFromBody(body);
    const reservation = await verifyAtsReservation(reservationToken, {
      userId: claims.sub,
      jobId: String(input.jobId || ""),
    });
    const claimed = await claimAtsReservationUse({
      reservationId: reservation.reservationId,
      userId: claims.sub,
    });
    if (!claimed) return jsonError("RESERVATION_INVALID");
  } catch (error) {
    return jsonError(publicErrorCode(error));
  }

  try {
    const result = await requestGeminiAts(input);
    return NextResponse.json({
      score: result.score,
      summary: result.summary,
      tips: result.tips,
      dimensions: result.dimensions,
      model: result.model,
      usage: result.usage,
    });
  } catch (error) {
    return jsonError(publicErrorCode(error));
  }
}
