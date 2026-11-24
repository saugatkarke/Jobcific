import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({ getOptionalSession: vi.fn() }));
vi.mock("@/lib/session-entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session-entitlement")>()),
  latestSubscriptionRow: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/paddle", () => ({ getPaddle: vi.fn() }));
vi.mock("@/lib/paddle-customer", () => ({ findOrCreatePaddleCustomer: vi.fn() }));

import { getDb } from "@/lib/db";
import { getPaddle } from "@/lib/paddle";
import { getOptionalSession } from "@/lib/session";
import { latestSubscriptionRow } from "@/lib/session-entitlement";
import { POST } from "./route";

const sessionMock = vi.mocked(getOptionalSession);
const subscriptionMock = vi.mocked(latestSubscriptionRow);
const createTransaction = vi.fn();

function request(body: unknown) {
  return new NextRequest("https://www.jobcific.com/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_legacy");
  vi.stubEnv("PADDLE_PRICE_ID_LENS_MONTHLY", "pri_lens");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_QUARTERLY", "pri_bifocal_q");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_MONTHLY", "pri_panorama");
  sessionMock.mockResolvedValue({
    user: { id: "user_123", email: "x@example.com" },
  } as Awaited<ReturnType<typeof getOptionalSession>>);
  subscriptionMock.mockResolvedValue(null);
  const query = {
    select: () => query,
    from: () => query,
    where: () => query,
    limit: async () => [{ paddleCustomerId: "ctm_123" }],
  };
  vi.mocked(getDb).mockReturnValue(query as unknown as ReturnType<typeof getDb>);
  createTransaction.mockResolvedValue({ id: "txn_123" });
  vi.mocked(getPaddle).mockReturnValue({
    transactions: { create: createTransaction },
  } as unknown as ReturnType<typeof getPaddle>);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/billing/checkout", () => {
  it("requires a session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const response = await POST(request({ priceId: "pri_lens", extensions: ["seek"] }));
    expect(response.status).toBe(401);
  });

  it("rejects unknown and legacy prices", async () => {
    for (const priceId of ["pri_other", "pri_legacy"]) {
      const response = await POST(request({ priceId, extensions: ["seek", "indeed"] }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_PRICE" });
    }
  });

  it.each([
    [[]],
    [["seek", "indeed"]],
    [["glassdoor"]],
    ["seek"],
  ])("rejects a Lens selection of %j", async (extensions) => {
    const response = await POST(request({ priceId: "pri_lens", extensions }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_EXTENSIONS" });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("rejects a duplicate Bifocal pick", async () => {
    const response = await POST(
      request({ priceId: "pri_bifocal_q", extensions: ["seek", "seek"] }),
    );
    expect(response.status).toBe(400);
  });

  it("blocks a second subscription", async () => {
    subscriptionMock.mockResolvedValueOnce({
      id: "sub_1",
      userId: "user_123",
      paddleSubscriptionId: "psub_1",
      paddlePriceId: "pri_legacy",
      extensions: null,
      carryPriceId: null,
      carryExtensions: null,
      carryUntil: null,
      status: "active",
      plan: "pro",
      currentPeriodEnd: new Date(Date.now() + 86400000),
      cancelAtPeriodEnd: false,
      occurredAt: new Date(),
      updatedAt: new Date(),
    });
    const response = await POST(request({ priceId: "pri_lens", extensions: ["seek"] }));
    expect(response.status).toBe(409);
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("sends the Bifocal picks to Paddle", async () => {
    const response = await POST(
      request({ priceId: "pri_bifocal_q", extensions: ["linkedin", "indeed"] }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ transactionId: "txn_123" });
    expect(createTransaction).toHaveBeenCalledWith({
      customerId: "ctm_123",
      items: [{ priceId: "pri_bifocal_q", quantity: 1 }],
      customData: { userId: "user_123", extensions: ["linkedin", "indeed"] },
    });
  });

  it("stores every extension for Panorama, ignoring the request list", async () => {
    await POST(request({ priceId: "pri_panorama", extensions: ["seek"] }));
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customData: { userId: "user_123", extensions: ["indeed", "linkedin", "seek"] },
      }),
    );
  });
});
