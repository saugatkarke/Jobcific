import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./extension-auth", () => ({
  verifyAccessJwt: vi.fn(),
}));

import { verifyAccessJwt } from "./extension-auth";
import {
  extensionClaimsFromRequest,
  proBillingIntervalFromRow,
} from "./session-entitlement";

const verifyAccessJwtMock = vi.mocked(verifyAccessJwt);

vi.stubEnv("PADDLE_PRICE_ID_MONTHLY", "pri_month");
vi.stubEnv("PADDLE_PRICE_ID_YEARLY", "pri_year");

afterEach(() => {
  vi.clearAllMocks();
});

describe("extensionClaimsFromRequest", () => {
  it("returns verified bearer claims", async () => {
    verifyAccessJwtMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "pro@example.com",
    });

    await expect(
      extensionClaimsFromRequest({
        headers: new Headers({ authorization: "Bearer token-123" }),
      }),
    ).resolves.toEqual({
      sub: "user_123",
      email: "pro@example.com",
    });

    expect(verifyAccessJwtMock).toHaveBeenCalledWith("token-123");
  });

  it("returns null when authorization is missing or not bearer", async () => {
    await expect(
      extensionClaimsFromRequest({ headers: new Headers() }),
    ).resolves.toBeNull();
    await expect(
      extensionClaimsFromRequest({
        headers: new Headers({ authorization: "Basic abc123" }),
      }),
    ).resolves.toBeNull();

    expect(verifyAccessJwtMock).not.toHaveBeenCalled();
  });

  it("returns null for an invalid bearer token", async () => {
    verifyAccessJwtMock.mockResolvedValueOnce(null);

    await expect(
      extensionClaimsFromRequest({
        headers: new Headers({ authorization: "Bearer bad-token" }),
      }),
    ).resolves.toBeNull();
  });
});

describe("proBillingIntervalFromRow", () => {
  it("returns monthly for an active monthly Pro subscription", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        paddlePriceId: "pri_month",
      }),
    ).toBe("monthly");
  });

  it("returns yearly for an active yearly Pro subscription", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        paddlePriceId: "pri_year",
      }),
    ).toBe("yearly");
  });

  it("returns null when the plan is no longer Pro", () => {
    expect(
      proBillingIntervalFromRow({
        plan: "pro",
        status: "canceled",
        currentPeriodEnd: new Date(Date.now() - 86400000),
        paddlePriceId: "pri_year",
      }),
    ).toBeNull();
  });
});
