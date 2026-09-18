import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session-entitlement", () => ({
  extensionClaimsFromRequest: vi.fn(),
  latestSubscriptionRow: vi.fn(),
}));
vi.mock("@/lib/ats-quota", () => ({ reserveAtsUsage: vi.fn() }));
vi.mock("@/lib/ats-reservation", () => ({ signAtsReservation: vi.fn() }));

import {
  extensionClaimsFromRequest,
  latestSubscriptionRow,
} from "@/lib/session-entitlement";
import { reserveAtsUsage } from "@/lib/ats-quota";
import { signAtsReservation } from "@/lib/ats-reservation";
import { POST } from "./route";

const claimsMock = vi.mocked(extensionClaimsFromRequest);
const subscriptionMock = vi.mocked(latestSubscriptionRow);
const reserveMock = vi.mocked(reserveAtsUsage);
const signMock = vi.mocked(signAtsReservation);

function request(body: unknown, token = "access-token") {
  return new NextRequest("https://www.jobcific.com/api/extension/ats-reservation", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

function proRow() {
  return {
    id: "sub_123",
    userId: "user_123",
    paddleSubscriptionId: "psub_123",
    paddlePriceId: "pri_123",
    status: "active",
    plan: "pro",
    currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    occurredAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-18T00:00:00.000Z"),
  };
}

function allow() {
  return {
    allowed: true,
    used: 1,
    limit: 1000,
    remaining: 999,
    periodEnd: "2026-10-01T00:00:00.000Z",
  };
}

describe("POST /api/extension/ats-reservation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.ATS_PERIOD_LIMIT;
  });

  it("requires extension authentication", async () => {
    claimsMock.mockResolvedValueOnce(null);
    const response = await POST(request({ jobId: "seek-123" }, ""));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTH_REQUIRED" });
    expect(subscriptionMock).not.toHaveBeenCalled();
  });

  it("requires an active Pro subscription", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    subscriptionMock.mockResolvedValueOnce({
      ...proRow(),
      status: "canceled",
      currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    });
    const response = await POST(request({ jobId: "seek-123" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "PRO_REQUIRED" });
    expect(reserveMock).not.toHaveBeenCalled();
  });

  it.each([{}, { jobId: "" }, { jobId: 42 }, { jobId: "x".repeat(257) }])(
    "rejects invalid reservation input",
    async (body) => {
      claimsMock.mockResolvedValueOnce({
        sub: "user_123",
        email: "x@example.com",
      });
      subscriptionMock.mockResolvedValueOnce(proRow());
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_INPUT" });
      expect(reserveMock).not.toHaveBeenCalled();
    },
  );

  it("returns exhausted allowance without signing", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    subscriptionMock.mockResolvedValueOnce(proRow());
    reserveMock.mockResolvedValueOnce({
      ...allow(),
      allowed: false,
      used: 1000,
      remaining: 0,
    });
    const response = await POST(request({ jobId: "seek-123" }));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "SUBSCRIPTION_LIMIT",
      allowance: {
        limit: 1000,
        used: 1000,
        remaining: 0,
        periodEnd: "2026-10-01T00:00:00.000Z",
      },
    });
    expect(signMock).not.toHaveBeenCalled();
  });

  it("reserves once and returns a user/job-bound ticket", async () => {
    process.env.ATS_PERIOD_LIMIT = "250";
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    subscriptionMock.mockResolvedValueOnce(proRow());
    reserveMock.mockResolvedValueOnce({ ...allow(), limit: 250, remaining: 249 });
    signMock.mockResolvedValueOnce("signed-reservation");
    const response = await POST(request({ jobId: " seek-123 " }));
    expect(reserveMock).toHaveBeenCalledWith({
      userId: "user_123",
      periodEnd: new Date("2026-10-01T00:00:00.000Z"),
      limit: 250,
    });
    expect(signMock).toHaveBeenCalledWith({
      userId: "user_123",
      jobId: "seek-123",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reservationToken: "signed-reservation",
      allowance: {
        limit: 250,
        used: 1,
        remaining: 249,
        periodEnd: "2026-10-01T00:00:00.000Z",
      },
    });
  });

  it("normalizes sensitive dependency failures", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com" });
    subscriptionMock.mockRejectedValueOnce(new Error("postgres://secret"));
    const response = await POST(request({ jobId: "seek-123" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "INTERNAL_ERROR" });
  });
});
