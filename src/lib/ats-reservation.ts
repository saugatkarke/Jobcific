import { SignJWT, jwtVerify } from "jose";
import type { ExtensionClient } from "./extensions";

const RESERVATION_TYPE = "ats-reservation";
const RESERVATION_TTL_SECONDS = 300;

function reservationKey(): Uint8Array {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("RESERVATION_INVALID");
  return new TextEncoder().encode(secret);
}

function unixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

export async function signAtsReservation(input: {
  userId: string;
  jobId: string;
  client?: ExtensionClient | null;
  reservationId?: string;
  now?: Date;
}): Promise<string> {
  try {
    const userId = String(input.userId || "").trim();
    const jobId = String(input.jobId || "").trim();
    if (!userId || !jobId) throw new Error("RESERVATION_INVALID");
    const issuedAt = unixSeconds(input.now ?? new Date());
    return await new SignJWT({
      typ: RESERVATION_TYPE,
      jobId,
      ...(input.client ? { client: input.client } : {}),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(input.reservationId || crypto.randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + RESERVATION_TTL_SECONDS)
      .sign(reservationKey());
  } catch {
    throw new Error("RESERVATION_INVALID");
  }
}

export async function verifyAtsReservation(
  token: string,
  expected: {
    userId: string;
    jobId: string;
    client?: ExtensionClient | null;
    now?: Date;
  },
): Promise<{ reservationId: string; userId: string; jobId: string }> {
  try {
    const { payload } = await jwtVerify(
      String(token || "").trim(),
      reservationKey(),
      expected.now
        ? { currentDate: expected.now, algorithms: ["HS256"] }
        : { algorithms: ["HS256"] },
    );
    const userId = String(payload.sub || "");
    const jobId = String(payload.jobId || "");
    const reservationId = String(payload.jti || "");
    /* Reservations signed before the client claim existed carry none. */
    const clientMismatch =
      payload.client !== undefined && payload.client !== (expected.client ?? null);
    if (
      payload.typ !== RESERVATION_TYPE ||
      !reservationId ||
      userId !== expected.userId ||
      jobId !== expected.jobId ||
      clientMismatch
    ) {
      throw new Error("RESERVATION_INVALID");
    }
    return { reservationId, userId, jobId };
  } catch {
    throw new Error("RESERVATION_INVALID");
  }
}
