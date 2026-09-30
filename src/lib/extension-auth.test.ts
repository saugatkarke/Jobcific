import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pkceS256Challenge } from "./crypto-hash";
import { GrantError, assertCodeUsable, assertPkceMatch } from "./extension-auth";

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
