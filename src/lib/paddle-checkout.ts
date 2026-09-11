import { initializePaddle } from "@paddle/paddle-js";

export type CheckoutResult =
  | { status: "ok" }
  | { status: "login" }
  | { status: "error"; message: string };

export function checkoutSuccessUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/account?checkout=success`;
}

export async function startPaddleCheckout(
  priceId: string,
): Promise<CheckoutResult> {
  if (!priceId) {
    return {
      status: "error",
      message:
        "Checkout is not configured yet. Add Paddle price IDs to .env.local.",
    };
  }
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    if (res.status === 401) {
      return { status: "login" };
    }
    if (res.status === 409) {
      return {
        status: "error",
        message: "You already have this plan.",
      };
    }
    const data = (await res.json()) as {
      transactionId?: string;
      error?: string;
    };
    if (!res.ok || !data.transactionId) {
      return {
        status: "error",
        message: "Checkout could not start. Try again.",
      };
    }
    const paddle = await initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
          ? "production"
          : "sandbox",
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
    });
    await paddle?.Checkout.open({
      transactionId: data.transactionId,
      settings: {
        successUrl: checkoutSuccessUrl(
          typeof window !== "undefined"
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || "",
        ),
      },
    });
    return { status: "ok" };
  } catch {
    return {
      status: "error",
      message: "Checkout could not start. Try again.",
    };
  }
}
