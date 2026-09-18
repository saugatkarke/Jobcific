import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session-entitlement", () => ({
  extensionClaimsFromRequest: vi.fn(),
}));
vi.mock("@/lib/ats-reservation", () => ({
  verifyAtsReservation: vi.fn(),
}));
vi.mock("@/lib/ats-reservation-use", () => ({
  claimAtsReservationUse: vi.fn(),
}));
vi.mock("@/lib/ats", () => ({
  requestGeminiAts: vi.fn(),
  validateAtsInput: vi.fn(),
}));

import { extensionClaimsFromRequest } from "@/lib/session-entitlement";
import { verifyAtsReservation } from "@/lib/ats-reservation";
import { claimAtsReservationUse } from "@/lib/ats-reservation-use";
import { requestGeminiAts, validateAtsInput } from "@/lib/ats";
import { POST, maxDuration } from "./route";
import {
  ATS_PLATFORM_BUDGET_SECONDS,
  ATS_ROUTE_MAX_DURATION_SECONDS,
  atsBoundedTotalMs,
} from "@/lib/ats-budget";

const claimsMock = vi.mocked(extensionClaimsFromRequest);
const verifyMock = vi.mocked(verifyAtsReservation);
const claimMock = vi.mocked(claimAtsReservationUse);
const geminiMock = vi.mocked(requestGeminiAts);
const validateMock = vi.mocked(validateAtsInput);

function request(body: unknown, token = "access-token") {
  return new NextRequest("https://www.jobcific.com/api/extension/ats-score", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

const validBody = {
  resumeText: "Resume body",
  jobText: "Job body",
  jobId: "seek-123",
  reservationToken: "reservation-token",
};

const validInput = {
  resumeText: "Resume body",
  jobText: "Job body",
  jobId: "seek-123",
};

function validReservation() {
  return {
    reservationId: "reservation-123",
    userId: "user_123",
    jobId: "seek-123",
  };
}

function modelResult() {
  return {
    score: 82,
    summary: "Strong match.",
    tips: ["Quantify achievements"],
    dimensions: {
      keywords: 88,
      experience: 80,
      skills: 90,
      formatting: 70,
      qualifications: 65,
      roleFit: 84,
    },
    model: "gemini-3.1-flash-lite",
    usage: { promptTokens: 321, completionTokens: 123, totalTokens: 444 },
  };
}

describe("ats-score route budget", () => {
  it("keeps the route inside the bounded platform budget", () => {
    expect(maxDuration).toBe(ATS_ROUTE_MAX_DURATION_SECONDS);
    expect(readFileSync("src/app/api/extension/ats-score/route.ts", "utf8")).toContain(
      `export const maxDuration = ${ATS_ROUTE_MAX_DURATION_SECONDS};`,
    );
    expect(maxDuration * 1000).toBeGreaterThan(atsBoundedTotalMs());
    expect(maxDuration).toBeLessThan(ATS_PLATFORM_BUDGET_SECONDS);
  });
});

describe("POST /api/extension/ats-score", () => {
  afterEach(() => vi.clearAllMocks());

  it("requires extension authentication", async () => {
    claimsMock.mockResolvedValueOnce(null);
    const response = await POST(request(validBody, ""));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_REQUIRED" });
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("validates ATS input before ticket verification", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockImplementationOnce(() => {
      throw new Error("INVALID_INPUT");
    });
    const response = await POST(request({ reservationToken: "ticket" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_INPUT" });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each([
    { ...validBody, reservationToken: "" },
    { ...validBody, reservationToken: 42 },
  ])("rejects a missing or malformed reservation ticket", async (body) => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    const response = await POST(request(body));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "RESERVATION_INVALID",
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("normalizes ticket verification failure", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    verifyMock.mockRejectedValueOnce(new Error("RESERVATION_INVALID"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "RESERVATION_INVALID",
    });
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("rejects an already claimed reservation before Gemini", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    verifyMock.mockResolvedValueOnce(validReservation());
    claimMock.mockResolvedValueOnce(false);
    const response = await POST(request(validBody));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "RESERVATION_INVALID",
    });
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("claims a valid ticket once and returns no allowance metadata", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    verifyMock.mockResolvedValueOnce(validReservation());
    claimMock.mockResolvedValueOnce(true);
    geminiMock.mockResolvedValueOnce(modelResult());
    const response = await POST(request(validBody));
    expect(verifyMock).toHaveBeenCalledWith("reservation-token", {
      userId: "user_123",
      jobId: "seek-123",
    });
    expect(claimMock).toHaveBeenCalledWith({
      reservationId: "reservation-123",
      userId: "user_123",
    });
    expect(geminiMock).toHaveBeenCalledWith(validInput);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(modelResult());
    expect(body).not.toHaveProperty("allowance");
  });

  it.each([
    ["MODEL_BUSY", 503],
    ["MODEL_RESPONSE_INVALID", 502],
    ["SERVER_MISCONFIGURED", 500],
  ])("maps %s to a stable %s response", async (code, status) => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    verifyMock.mockResolvedValueOnce(validReservation());
    claimMock.mockResolvedValueOnce(true);
    geminiMock.mockRejectedValueOnce(new Error(code));
    const response = await POST(request(validBody));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
  });

  it("hides sensitive unexpected failures", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    validateMock.mockReturnValueOnce(validInput);
    verifyMock.mockResolvedValueOnce(validReservation());
    claimMock.mockRejectedValueOnce(new Error("postgres://secret"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "INTERNAL_ERROR" });
    expect(geminiMock).not.toHaveBeenCalled();
  });
});
