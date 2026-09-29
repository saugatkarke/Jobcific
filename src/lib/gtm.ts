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
