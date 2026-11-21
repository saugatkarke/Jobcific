import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./extension-auth", () => ({
  verifyAccessJwt: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./auth", () => ({ getAuth: vi.fn() }));

import type { NextRequest } from "next/server";
import { getAuth } from "./auth";
import { getDb } from "./db";
import { verifyAccessJwt } from "./extension-auth";
import {
  entitlementForUser,
  entitlementPayload,
  extensionClaimsFromRequest,
  proBillingIntervalFromRow,
} from "./session-entitlement";

const verifyAccessJwtMock = vi.mocked(verifyAccessJwt);
const getDbMock = vi.mocked(getDb);
const getAuthMock = vi.mocked(getAuth);

function mockSubscriptionRows(rows: unknown[]) {
  const query = {
    select: () => query,
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: async () => rows,
  };
  getDbMock.mockReturnValue(query as unknown as ReturnType<typeof getDb>);
}

function activeProRow() {
  return {
    plan: "pro",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 86400000),
    paddlePriceId: "pri_month",
  };
}

function bearer(): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer token-123" }),
  } as unknown as NextRequest;
}

describe("entitlementPayload per extension", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-32-characters");
  });

  it("grants Pro to an extension the plan includes", async () => {
    verifyAccessJwtMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "pro@example.com",
      client: "indeed",
    });
    mockSubscriptionRows([activeProRow()]);
    const body = await entitlementPayload(bearer());
    expect(body).toMatchObject({
      plan: "pro",
      features: { hideJobs: true, atsResults: true },
      extensions: ["seek", "indeed"],
    });
    expect(body).not.toHaveProperty("reason");
  });

  it("downgrades an extension the plan does not include", async () => {
    verifyAccessJwtMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "pro@example.com",
      client: "linkedin",
    });
    mockSubscriptionRows([activeProRow()]);
    await expect(entitlementPayload(bearer())).resolves.toMatchObject({
      plan: "free",
      status: "active",
      interval: "monthly",
      features: { hideJobs: false, atsResults: false },
      extensions: ["seek", "indeed"],
      reason: "extension_not_included",
    });
  });

  it("keeps Pro for a legacy token with no client", async () => {
    verifyAccessJwtMock.mockResolvedValueOnce({
      sub: "user_123",
      email: "pro@example.com",
      client: null,
    });
    mockSubscriptionRows([activeProRow()]);
    await expect(entitlementPayload(bearer())).resolves.toMatchObject({
      plan: "pro",
    });
  });

  it("returns the account view for a website session", async () => {
    getAuthMock.mockReturnValue({
      api: {
        getSession: async () => ({
          user: { id: "user_123", email: "pro@example.com" },
        }),
      },
    } as unknown as ReturnType<typeof getAuth>);
    mockSubscriptionRows([activeProRow()]);
    const body = await entitlementPayload({
      headers: new Headers(),
    } as unknown as NextRequest);
    expect(body).toMatchObject({ plan: "pro", extensions: ["seek", "indeed"] });
    expect(body).not.toHaveProperty("reason");
  });
});

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
      client: "seek",
    });

    await expect(
      extensionClaimsFromRequest({
        headers: new Headers({ authorization: "Bearer token-123" }),
      }),
    ).resolves.toEqual({
      sub: "user_123",
      email: "pro@example.com",
      client: "seek",
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

describe("entitlementForUser", () => {
  it("returns a free entitlement when no database is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(
      entitlementForUser("user_123", "free@example.com"),
    ).resolves.toMatchObject({
      authenticated: true,
      email: "free@example.com",
      plan: "free",
      status: "none",
      interval: null,
    });
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
