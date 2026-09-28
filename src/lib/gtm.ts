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
