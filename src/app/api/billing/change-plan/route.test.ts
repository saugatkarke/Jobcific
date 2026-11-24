import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({ getOptionalSession: vi.fn() }));
vi.mock("@/lib/session-entitlement", () => ({ latestSubscriptionRow: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/paddle", () => ({ getPaddle: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendPlanChangeEmail: vi.fn() }));

import { getDb } from "@/lib/db";
import { sendPlanChangeEmail } from "@/lib/mail";
import { getPaddle } from "@/lib/paddle";
import { getOptionalSession } from "@/lib/session";
import { latestSubscriptionRow } from "@/lib/session-entitlement";
import { POST as previewPOST } from "./preview/route";
import { DELETE, POST } from "./route";

const sessionMock = vi.mocked(getOptionalSession);
const subscriptionMock = vi.mocked(latestSubscriptionRow);
const mailMock = vi.mocked(sendPlanChangeEmail);
const updateSubscription = vi.fn();
const previewUpdate = vi.fn();
const setMock = vi.fn();

const PERIOD_END = new Date(Date.now() + 10 * 86400000);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    userId: "user_123",
    paddleSubscriptionId: "psub_1",
    paddlePriceId: "pri_panorama_m",
    extensions: ["seek", "indeed", "linkedin"],
    carryPriceId: null,
    carryExtensions: null,
    carryUntil: null,
    status: "active",
    plan: "pro",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    occurredAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Awaited<ReturnType<typeof latestSubscriptionRow>>;
}

function request(method: string, body?: unknown) {
  return new NextRequest("https://www.jobcific.com/api/billing/change-plan", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_legacy");
  vi.stubEnv("PADDLE_PRICE_ID_LENS_MONTHLY", "pri_lens_m");
  vi.stubEnv("PADDLE_PRICE_ID_BIFOCAL_MONTHLY", "pri_bifocal_m");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_MONTHLY", "pri_panorama_m");
  vi.stubEnv("PADDLE_PRICE_ID_PANORAMA_QUARTERLY", "pri_panorama_q");
  sessionMock.mockResolvedValue({
    user: { id: "user_123", email: "x@example.com", name: "Sam" },
  } as Awaited<ReturnType<typeof getOptionalSession>>);
  subscriptionMock.mockResolvedValue(row());
  const chain = { set: setMock, where: vi.fn(async () => undefined) };
  setMock.mockReturnValue(chain);
  vi.mocked(getDb).mockReturnValue({ update: () => chain } as unknown as ReturnType<typeof getDb>);
  updateSubscription.mockResolvedValue({
    nextBilledAt: "2027-02-23T00:00:00Z",
    currentBillingPeriod: { endsAt: "2027-02-23T00:00:00Z" },
  });
  previewUpdate.mockResolvedValue({
    nextBilledAt: "2027-02-23T00:00:00Z",
    updateSummary: { result: { action: "charge", amount: "1612" } },
  });
  vi.mocked(getPaddle).mockReturnValue({
    subscriptions: { update: updateSubscription, previewUpdate },
  } as unknown as ReturnType<typeof getPaddle>);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/billing/change-plan/preview", () => {
  it("requires a session", async () => {
    sessionMock.mockResolvedValueOnce(null);
    expect((await previewPOST(request("POST", {}))).status).toBe(401);
  });

  it("previews an interval switch with today's charge from Paddle", async () => {
    const response = await previewPOST(request("POST", { priceId: "pri_panorama_q", extensions: [] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "interval",
      chargeToday: 16.12,
      nextAmount: 23.99,
      nextBilledAt: "2027-02-23T00:00:00.000Z",
      dropsLegacy: false,
    });
    expect(previewUpdate).toHaveBeenCalledWith(
      "psub_1",
      expect.objectContaining({ prorationBillingMode: "prorated_immediately" }),
    );
  });

  it("previews a downgrade without calling Paddle", async () => {
    const response = await previewPOST(
      request("POST", { priceId: "pri_lens_m", extensions: ["seek"] }),
    );
    await expect(response.json()).resolves.toMatchObject({
      kind: "downgrade",
      chargeToday: 0,
      effectiveAt: PERIOD_END.toISOString(),
    });
    expect(previewUpdate).not.toHaveBeenCalled();
  });

  it("returns the rule error", async () => {
    const response = await previewPOST(
      request("POST", { priceId: "pri_bifocal_m", extensions: ["seek", "glassdoor"] }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_EXTENSIONS" });
  });
});

describe("POST /api/billing/change-plan", () => {
  it("schedules a downgrade, keeps the current plan, and emails the user", async () => {
    const response = await POST(request("POST", { priceId: "pri_lens_m", extensions: ["seek"] }));
    expect(response.status).toBe(200);
    expect(updateSubscription).toHaveBeenCalledWith("psub_1", {
      items: [{ priceId: "pri_lens_m", quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
      customData: { userId: "user_123", extensions: ["seek"] },
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        carryPriceId: "pri_panorama_m",
        carryExtensions: ["seek", "indeed", "linkedin"],
        carryUntil: PERIOD_END,
        paddlePriceId: "pri_lens_m",
        extensions: ["seek"],
      }),
    );
    expect(mailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "x@example.com",
        nextPlan: "Lens (Seek)",
        nextPrice: "$4.99 a month",
      }),
    );
  });

  it("still schedules the downgrade when the email fails", async () => {
    mailMock.mockRejectedValueOnce(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request("POST", { priceId: "pri_lens_m", extensions: ["seek"] }));
    expect(response.status).toBe(200);
    spy.mockRestore();
  });

  it("applies an upgrade now with prorated billing and no email", async () => {
    subscriptionMock.mockResolvedValueOnce(
      row({ paddlePriceId: "pri_lens_m", extensions: ["seek"] }),
    );
    const response = await POST(
      request("POST", { priceId: "pri_bifocal_m", extensions: ["seek", "linkedin"] }),
    );
    expect(response.status).toBe(200);
    expect(updateSubscription).toHaveBeenCalledWith(
      "psub_1",
      expect.objectContaining({
        prorationBillingMode: "prorated_immediately",
        onPaymentFailure: "prevent_change",
      }),
    );
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ paddlePriceId: "pri_bifocal_m", extensions: ["seek", "linkedin"] }),
    );
    expect(setMock.mock.calls[0][0]).not.toHaveProperty("carryPriceId");
    expect(mailMock).not.toHaveBeenCalled();
  });

  it("blocks a second change while one is scheduled", async () => {
    subscriptionMock.mockResolvedValueOnce(
      row({ carryPriceId: "pri_bifocal_m", carryUntil: PERIOD_END }),
    );
    const response = await POST(request("POST", { priceId: "pri_lens_m", extensions: ["seek"] }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "CHANGE_PENDING" });
    expect(updateSubscription).not.toHaveBeenCalled();
  });

  it("reports a Paddle rejection without writing anything", async () => {
    updateSubscription.mockRejectedValueOnce(new Error("too close to renewal"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request("POST", { priceId: "pri_lens_m", extensions: ["seek"] }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "PADDLE_REJECTED" });
    expect(setMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("DELETE /api/billing/change-plan", () => {
  it("restores the carried plan in Paddle and clears the schedule", async () => {
    subscriptionMock.mockResolvedValueOnce(
      row({
        paddlePriceId: "pri_lens_m",
        extensions: ["seek"],
        carryPriceId: "pri_legacy",
        carryExtensions: null,
        carryUntil: PERIOD_END,
      }),
    );
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(200);
    expect(updateSubscription).toHaveBeenCalledWith("psub_1", {
      items: [{ priceId: "pri_legacy", quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
      customData: { userId: "user_123" },
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paddlePriceId: "pri_legacy",
        extensions: null,
        carryPriceId: null,
        carryUntil: null,
      }),
    );
  });

  it("needs a scheduled change", async () => {
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "NO_PENDING_CHANGE" });
  });
});
