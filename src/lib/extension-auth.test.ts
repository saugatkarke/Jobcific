import { readFileSync } from "node:fs";
import { SignJWT, decodeJwt } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pkceS256Challenge } from "./crypto-hash";
import {
  GrantError,
  assertCodeUsable,
  assertPkceMatch,
  signAccessJwt,
  verifyAccessJwt,
} from "./extension-auth";

describe("access token client claim", () => {
  const secret = "test-secret-at-least-32-characters";
  const owner = { id: "user_123", email: "x@example.com" };

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.BETTER_AUTH_SECRET;
  });

  it("carries the extension that signed in", async () => {
    const token = await signAccessJwt(owner, "linkedin");
    expect(decodeJwt(token).client).toBe("linkedin");
    await expect(verifyAccessJwt(token)).resolves.toEqual({
      sub: "user_123",
      email: "x@example.com",
      client: "linkedin",
    });
  });

  it("omits the claim for a legacy token", async () => {
    const token = await signAccessJwt(owner, null);
    expect(decodeJwt(token)).not.toHaveProperty("client");
    await expect(verifyAccessJwt(token)).resolves.toMatchObject({ client: null });
  });

  it("treats an unknown client claim as legacy", async () => {
    const token = await new SignJWT({
      email: owner.email,
      typ: "extension",
      client: "glassdoor",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(owner.id)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(secret));
    await expect(verifyAccessJwt(token)).resolves.toMatchObject({ client: null });
  });
});

describe("assertPkceMatch", () => {
  it("accepts a matching verifier", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(() => assertPkceMatch(verifier, pkceS256Challenge(verifier))).not.toThrow();
  });

  it("rejects a mismatched verifier", () => {
    expect(() => assertPkceMatch("wrong-verifier-value-here", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toThrow(
      GrantError,
    );
  });
});

describe("assertCodeUsable", () => {
  const redirectUri = "https://abcdefghijklmnopqrstuvwxyzabcdefghijk.chromiumapp.org/";
  const future = new Date("2026-08-24T00:05:00.000Z");
  const now = new Date("2026-08-24T00:00:00.000Z");

  it("rejects a consumed code", () => {
    expect(() =>
      assertCodeUsable(
        { consumedAt: now, expiresAt: future, redirectUri },
        now,
        redirectUri,
      ),
    ).toThrow(GrantError);
  });

  it("rejects a mismatched redirect_uri", () => {
    expect(() =>
      assertCodeUsable(
        { consumedAt: null, expiresAt: future, redirectUri },
        now,
        "https://evil.example/",
      ),
    ).toThrow(GrantError);
  });
});

describe("extension client tracking", () => {
  const src = readFileSync("src/lib/extension-auth.ts", "utf8");
  const schema = readFileSync("src/lib/schema.ts", "utf8");

  it("stores which extension each refresh token belongs to", () => {
    expect(schema).toMatch(
      /extensionRefreshToken = pgTable\([\s\S]{0,400}client: text\("client"\)/,
    );
    expect(src).toContain("extensionClientForRedirectUri(args.redirectUri)");
    expect(src).toContain("issueTokens(owner.id, owner.email, row.client)");
  });

  it("lists active connections per extension for the account page", () => {
    expect(src).toContain("export async function listExtensionConnections");
    expect(src).toContain("isNull(extensionRefreshToken.revokedAt)");
    expect(src).toContain("gt(extensionRefreshToken.expiresAt");
    expect(src).toContain("groupBy(extensionRefreshToken.client)");
  });
});
