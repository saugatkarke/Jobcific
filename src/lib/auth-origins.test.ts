import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appTrustedOrigins,
  authPageHref,
  betterAuthAcceptsCallbackURL,
} from "./auth-origins";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appTrustedOrigins", () => {
  it("dedupes auth and public app URLs and strips trailing slashes", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://jobcific.com/");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobcific.com");
    expect(appTrustedOrigins()).toEqual(["https://jobcific.com"]);
  });

  it("keeps distinct origins when they differ", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://jobcific.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.jobcific.com");
    expect(appTrustedOrigins()).toEqual([
      "https://jobcific.com",
      "https://www.jobcific.com",
    ]);
  });
});

describe("betterAuthAcceptsCallbackURL", () => {
  it("accepts simple in-app paths", () => {
    expect(betterAuthAcceptsCallbackURL("/account")).toBe(true);
    expect(betterAuthAcceptsCallbackURL("/login")).toBe(true);
  });

  it("rejects the extension connect next URL because of https in the query", () => {
    const next =
      "/extension/connect?redirect_uri=https://omdijdkofmlgjjipfaknienpebhoafem.chromiumapp.org/&state=abc&code_challenge=abc&code_challenge_method=S256";
    expect(betterAuthAcceptsCallbackURL(next)).toBe(false);
  });
});

describe("authPageHref", () => {
  it("keeps the extension connect next on login and signup links", () => {
    const next =
      "/extension/connect?redirect_uri=https://omdijdkofmlgjjipfaknienpebhoafem.chromiumapp.org/&state=abc";
    expect(authPageHref("/signup", next)).toBe(
      `/signup?next=${encodeURIComponent(next)}`,
    );
    expect(authPageHref("/login", next)).toBe(
      `/login?next=${encodeURIComponent(next)}`,
    );
  });

  it("omits next when it is the default account path", () => {
    expect(authPageHref("/signup", "/account")).toBe("/signup");
  });
});
