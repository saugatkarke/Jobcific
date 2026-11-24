import type { BillingInterval, PlanId } from "./pricing";

type DataLayerEvent = {
  event: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

export function signUpDataLayerEvent(input: {
  nextPath: string;
  userId?: string;
}): DataLayerEvent {
  return {
    event: "sign_up",
    method: "email",
    next_path: input.nextPath,
    ...(input.userId ? { user_id: input.userId } : {}),
  };
}

export function pushSignUp(input: { nextPath: string; userId?: string }) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(signUpDataLayerEvent(input));
}

export function emailVerifiedDataLayerEvent(userId: string): DataLayerEvent {
  return {
    event: "email_verified",
    user_id: userId,
  };
}

export function pushEmailVerified(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(emailVerifiedDataLayerEvent(userId));
}

export type LoginMethod = "email" | "magic_link";

export function loginDataLayerEvent(input: {
  method: LoginMethod;
  userId?: string;
}): DataLayerEvent {
  return {
    event: "login",
    method: input.method,
    ...(input.userId ? { user_id: input.userId } : {}),
  };
}

export type PlanEventInput = {
  interval: BillingInterval;
  plan: PlanId;
  value: number;
};

export function beginCheckoutDataLayerEvent(input: PlanEventInput): DataLayerEvent {
  return {
    event: "begin_checkout",
    currency: "USD",
    value: input.value,
    interval: input.interval,
    plan: input.plan,
  };
}

export function pushBeginCheckout(input: PlanEventInput) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(beginCheckoutDataLayerEvent(input));
}

export function purchaseDataLayerEvent(input: PlanEventInput): DataLayerEvent {
  return {
    event: "purchase",
    currency: "USD",
    value: input.value,
    interval: input.interval,
    plan: input.plan,
  };
}

export function pushPurchase(input: PlanEventInput) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(purchaseDataLayerEvent(input));
}

export function extensionConnectDataLayerEvent(userId: string): DataLayerEvent {
  return {
    event: "extension_connect",
    user_id: userId,
  };
}

export function pushExtensionConnect(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(extensionConnectDataLayerEvent(userId));
}

export function pushLogin(
  input: { method: LoginMethod; userId?: string },
  onSent?: () => void,
) {
  if (typeof window === "undefined") {
    onSent?.();
    return;
  }
  const payload = loginDataLayerEvent(input);
  window.dataLayer = window.dataLayer ?? [];
  if (!onSent) {
    window.dataLayer.push(payload);
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onSent();
  };
  window.dataLayer.push({
    ...payload,
    eventCallback: finish,
    eventTimeout: 2000,
  });
  globalThis.setTimeout(finish, 2000);
}
