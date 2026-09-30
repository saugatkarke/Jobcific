import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginCheckoutDataLayerEvent,
  emailVerifiedDataLayerEvent,
  loginDataLayerEvent,
  pushBeginCheckout,
  pushEmailVerified,
  pushLogin,
  pushPurchase,
  purchaseDataLayerEvent,
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

describe("loginDataLayerEvent", () => {
  it("sends login method and user id", () => {
    expect(loginDataLayerEvent({ method: "email", userId: "user-1" })).toEqual({
      event: "login",
      method: "email",
      user_id: "user-1",
    });
  });
});

describe("pushLogin", () => {
  it("appends the login event and continues after the tag callback", () => {
    vi.useFakeTimers();
    const dataLayer: Array<Record<string, unknown> & { eventCallback?: () => void }> =
      [];
    vi.stubGlobal("window", { dataLayer });
    const onSent = vi.fn();

    pushLogin({ method: "email", userId: "user-1" }, onSent);
    dataLayer[0]?.eventCallback?.();

    expect(dataLayer[0]).toMatchObject({
      event: "login",
      method: "email",
      user_id: "user-1",
    });
    expect(onSent).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("beginCheckoutDataLayerEvent", () => {
  it("sends the monthly price when checkout opens", () => {
    expect(
      beginCheckoutDataLayerEvent({ interval: "monthly", value: 4.99 }),
    ).toEqual({
      event: "begin_checkout",
      currency: "USD",
      value: 4.99,
      interval: "monthly",
    });
  });

  it("sends the yearly price when checkout opens", () => {
    expect(
      beginCheckoutDataLayerEvent({ interval: "yearly", value: 39 }),
    ).toEqual({
      event: "begin_checkout",
      currency: "USD",
      value: 39,
      interval: "yearly",
    });
  });
});

describe("pushBeginCheckout", () => {
  it("appends the checkout event to the GTM data layer", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    pushBeginCheckout({ interval: "yearly", value: 39 });

    expect(dataLayer).toEqual([
      {
        event: "begin_checkout",
        currency: "USD",
        value: 39,
        interval: "yearly",
      },
    ]);
  });
});

describe("purchaseDataLayerEvent", () => {
  it("sends the monthly purchase value", () => {
    expect(purchaseDataLayerEvent({ interval: "monthly", value: 4.99 })).toEqual({
      event: "purchase",
      currency: "USD",
      value: 4.99,
      interval: "monthly",
    });
  });

  it("sends the yearly purchase value", () => {
    expect(purchaseDataLayerEvent({ interval: "yearly", value: 39 })).toEqual({
      event: "purchase",
      currency: "USD",
      value: 39,
      interval: "yearly",
    });
  });
});

describe("pushPurchase", () => {
  it("appends the purchase event to the GTM data layer", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("window", { dataLayer });

    pushPurchase({ interval: "monthly", value: 4.99 });

    expect(dataLayer).toEqual([
      {
        event: "purchase",
        currency: "USD",
        value: 4.99,
        interval: "monthly",
      },
    ]);
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
