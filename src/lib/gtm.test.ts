import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailVerifiedDataLayerEvent,
  pushEmailVerified,
  pushSignUp,
  signUpDataLayerEvent,
} from "./gtm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signUpDataLayerEvent", () => {
  it("sends method, next path, and user id", () => {
    expect(
      signUpDataLayerEvent({ nextPath: "/account", userId: "user-1" }),
    ).toEqual({
      event: "sign_up",
      method: "email",
      next_path: "/account",
      user_id: "user-1",
    });
  });

  it("omits user id when the signup response has none", () => {
    expect(signUpDataLayerEvent({ nextPath: "/pricing" })).toEqual({
      event: "sign_up",
      method: "email",
      next_path: "/pricing",
    });
  });
});

describe("pushSignUp", () => {
  it("appends the event to the GTM data layer", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    pushSignUp({ nextPath: "/account", userId: "user-1" });

    expect(dataLayer).toEqual([
      {
        event: "sign_up",
        method: "email",
        next_path: "/account",
        user_id: "user-1",
      },
    ]);
  });

  it("creates the data layer when GTM has not initialized it yet", () => {
    const win: { dataLayer?: Record<string, unknown>[] } = {};
    vi.stubGlobal("window", win);

    pushSignUp({ nextPath: "/account" });

    expect(win.dataLayer).toEqual([
      {
        event: "sign_up",
        method: "email",
        next_path: "/account",
      },
    ]);
  });
});

describe("emailVerifiedDataLayerEvent", () => {
  it("sends the verified event with the user id only", () => {
    expect(emailVerifiedDataLayerEvent("user-1")).toEqual({
      event: "email_verified",
      user_id: "user-1",
    });
  });
});

describe("pushEmailVerified", () => {
  it("appends the verified event to the GTM data layer", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    pushEmailVerified("user-1");

    expect(dataLayer).toEqual([
      {
        event: "email_verified",
        user_id: "user-1",
      },
    ]);
  });
});
