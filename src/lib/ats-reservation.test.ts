import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { signAtsReservation, verifyAtsReservation } from "./ats-reservation";

const NOW = new Date("2026-09-18T08:00:00.000Z");

describe("ATS reservation tickets", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-characters";
  });

  afterEach(() => {
    delete process.env.BETTER_AUTH_SECRET;
  });

  it("signs a five-minute ticket and verifies its bindings", async () => {
    const token = await signAtsReservation({
      userId: "user_123",
      jobId: "seek-123",
      reservationId: "reservation-123",
      now: NOW,
    });
    const payload = decodeJwt(token);

    expect(payload.typ).toBe("ats-reservation");
    expect(payload.jti).toBe("reservation-123");
    expect(payload.exp).toBe(payload.iat! + 300);
    await expect(
      verifyAtsReservation(token, {
        userId: "user_123",
        jobId: "seek-123",
        now: new Date("2026-09-18T08:04:59.000Z"),
      }),
    ).resolves.toEqual({
      reservationId: "reservation-123",
      userId: "user_123",
      jobId: "seek-123",
    });
  });

  it("generates a reservation identifier when omitted", async () => {
    const token = await signAtsReservation({
      userId: "user_123",
      jobId: "seek-123",
      now: NOW,
    });
    expect(decodeJwt(token).jti).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it.each([
    ["wrong user", { userId: "other", jobId: "seek-123", now: NOW }],
    ["wrong job", { userId: "user_123", jobId: "other", now: NOW }],
    [
      "expired",
      {
        userId: "user_123",
        jobId: "seek-123",
        now: new Date("2026-09-18T08:05:01.000Z"),
      },
    ],
  ])("rejects %s", async (_name, expected) => {
    const token = await signAtsReservation({
      userId: "user_123",
      jobId: "seek-123",
      now: NOW,
    });
    await expect(verifyAtsReservation(token, expected)).rejects.toThrow(
      "RESERVATION_INVALID",
    );
  });

  it("normalizes bad signatures and missing configuration", async () => {
    await expect(
      verifyAtsReservation("not-a-jwt", {
        userId: "user_123",
        jobId: "seek-123",
        now: NOW,
      }),
    ).rejects.toThrow("RESERVATION_INVALID");

    delete process.env.BETTER_AUTH_SECRET;
    await expect(
      signAtsReservation({ userId: "user_123", jobId: "seek-123", now: NOW }),
    ).rejects.toThrow("RESERVATION_INVALID");
  });
});
