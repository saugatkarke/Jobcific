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
    extensions: null as string[] | null,
    carryPriceId: null as string | null,
    carryExtensions: null as string[] | null,
    carryUntil: null as Date | null,
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
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com", client: null });
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

  it("rejects an extension the plan does not include", async () => {
    claimsMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "x@example.com",
      client: "linkedin",
    });
    subscriptionMock.mockResolvedValueOnce(proRow());
    const response = await POST(request({ jobId: "li-123" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "PRO_REQUIRED",
      reason: "extension_not_included",
    });
    expect(reserveMock).not.toHaveBeenCalled();
  });

  it("binds the ticket to an included extension", async () => {
    claimsMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "x@example.com",
      client: "seek",
    });
    subscriptionMock.mockResolvedValueOnce(proRow());
    reserveMock.mockResolvedValueOnce(allow());
    signMock.mockResolvedValueOnce("signed-reservation");
    const response = await POST(request({ jobId: "seek-123" }));
    expect(response.status).toBe(200);
    expect(signMock).toHaveBeenCalledWith({
      userId: "user_123",
      jobId: "seek-123",
      client: "seek",
    });
  });

  it("scales the ATS limit to a quarterly billing period", async () => {
    process.env.ATS_PERIOD_LIMIT = "250";
    process.env.PADDLE_PRICE_ID_LENS_QUARTERLY = "pri_lens_q";
    claimsMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "x@example.com",
      client: "linkedin",
    });
    subscriptionMock.mockResolvedValueOnce({
      ...proRow(),
      paddlePriceId: "pri_lens_q",
      extensions: ["linkedin"],
    });
    reserveMock.mockResolvedValueOnce(allow());
    signMock.mockResolvedValueOnce("signed-reservation");
    const response = await POST(request({ jobId: "li-123" }));
    expect(response.status).toBe(200);
    expect(reserveMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 750 }),
    );
    delete process.env.PADDLE_PRICE_ID_LENS_QUARTERLY;
  });

  it("keeps the carried plan's extensions until a scheduled downgrade takes effect", async () => {
    process.env.PADDLE_PRICE_ID_LENS_MONTHLY = "pri_lens_m";
    process.env.PADDLE_PRICE_ID_PANORAMA_MONTHLY = "pri_panorama_m";
    const downgraded = {
      ...proRow(),
      paddlePriceId: "pri_lens_m",
      extensions: ["seek"],
      carryPriceId: "pri_panorama_m",
      carryExtensions: ["seek", "indeed", "linkedin"],
    };
    claimsMock.mockResolvedValue({ sub: "user_123", email: "x@example.com", client: "linkedin" });
    reserveMock.mockResolvedValue(allow());
    signMock.mockResolvedValue("signed-reservation");

    subscriptionMock.mockResolvedValueOnce({
      ...downgraded,
      carryUntil: new Date(Date.now() + 86400000),
    });
    expect((await POST(request({ jobId: "li-1" }))).status).toBe(200);

    subscriptionMock.mockResolvedValueOnce({
      ...downgraded,
      carryUntil: new Date(Date.now() - 1000),
    });
    expect((await POST(request({ jobId: "li-2" }))).status).toBe(403);
    delete process.env.PADDLE_PRICE_ID_LENS_MONTHLY;
    delete process.env.PADDLE_PRICE_ID_PANORAMA_MONTHLY;
  });

  it.each([{}, { jobId: "" }, { jobId: 42 }, { jobId: "x".repeat(257) }])(
    "rejects invalid reservation input",
    async (body) => {
      claimsMock.mockResolvedValueOnce({
        sub: "user_123",
        email: "x@example.com",
        client: null,
      });
      subscriptionMock.mockResolvedValueOnce(proRow());
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_INPUT" });
      expect(reserveMock).not.toHaveBeenCalled();
    },
  );

  it("returns exhausted allowance without signing", async () => {
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com", client: null });
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
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com", client: null });
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
    claimsMock.mockResolvedValueOnce({ sub: "user_123", email: "x@example.com", client: null });
    subscriptionMock.mockRejectedValueOnce(new Error("postgres://secret"));
    const response = await POST(request({ jobId: "seek-123" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "INTERNAL_ERROR" });
  });
});
