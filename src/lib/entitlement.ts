import type { ExtensionClient } from "./extensions";

export type Entitlement = {
  plan: "pro" | "free";
  status: string;
  currentPeriodEnd: string | null;
  features: { hideJobs: boolean; atsResults: boolean };
};

export type SubscriptionSnapshot = {
  plan: string;
  status: string;
  currentPeriodEnd: string | Date | null;
};

export function emptyEntitlement(): Entitlement {
  return {
    plan: "free",
    status: "none",
    currentPeriodEnd: null,
    features: { hideJobs: false, atsResults: false },
  };
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function resolveEntitlement(
  row: SubscriptionSnapshot | null | undefined,
  nowMs: number = Date.now(),
): Entitlement {
  if (!row || row.plan !== "pro") {
    return {
      ...emptyEntitlement(),
      status: row?.status || "none",
      currentPeriodEnd: toIso(row?.currentPeriodEnd ?? null),
    };
  }

  const endIso = toIso(row.currentPeriodEnd);
  const endMs = endIso ? Date.parse(endIso) : 0;
  const inPaidPeriod = endMs > nowMs;
  const status = String(row.status || "none");
  const isPro =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    (status === "canceled" && inPaidPeriod);

  const plan = isPro ? "pro" : "free";
  return {
    plan,
    status,
    currentPeriodEnd: endIso,
    features: { hideJobs: plan === "pro", atsResults: plan === "pro" },
  };
}

const LEGACY_EXTENSIONS: readonly ExtensionClient[] = ["seek", "indeed"];

/* Every Pro subscription today is the legacy plan covering Seek and Indeed. */
export function entitledExtensions(resolved: Entitlement): ExtensionClient[] {
  return resolved.plan === "pro" ? [...LEGACY_EXTENSIONS] : [];
}

/* A null client is a token from before extensions were told apart, so Seek or Indeed. */
export function isClientEntitled(
  client: ExtensionClient | null,
  extensions: readonly ExtensionClient[],
): boolean {
  if (client) return extensions.includes(client);
  return LEGACY_EXTENSIONS.every((ext) => extensions.includes(ext));
}

export const EXTENSION_NOT_INCLUDED = "extension_not_included";
