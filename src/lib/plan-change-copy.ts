import type { ChangeKind } from "./plan-change";
import { formatPrice, type CheckoutInterval } from "./pricing";

export type ChangePreview = {
  kind: ChangeKind;
  effectiveAt: string;
  chargeToday: number;
  nextAmount: number;
  nextBilledAt: string | null;
  dropsLegacy: boolean;
};

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function money(amount: number): string {
  return formatPrice(Number(Math.abs(amount).toFixed(2)));
}

function perPeriod(interval: CheckoutInterval): string {
  return interval === "quarterly" ? "a quarter" : "a month";
}

const LEGACY_NOTE = " Your legacy $4.99 price ends with this change.";

export function changeSummaryText({
  preview,
  currentLabel,
  nextLabel,
  interval,
}: {
  preview: ChangePreview;
  currentLabel: string;
  nextLabel: string;
  interval: CheckoutInterval;
}): string {
  const then = `then ${money(preview.nextAmount)} ${perPeriod(interval)}`;
  const legacy = preview.dropsLegacy ? LEGACY_NOTE : "";
  if (preview.kind === "downgrade") {
    return `Downgrade to ${nextLabel} on ${shortDate(preview.effectiveAt)}. You keep ${currentLabel} until then, ${then}.${legacy}`;
  }
  const today =
    preview.chargeToday > 0
      ? `You'll be charged ${money(preview.chargeToday)} today`
      : preview.chargeToday < 0
        ? `Your unused time leaves a ${money(preview.chargeToday)} credit for future bills`
        : "Nothing to pay today";
  if (preview.kind === "upgrade") {
    return `Upgrade to ${nextLabel} now. ${today}, ${then}.${legacy}`;
  }
  const billed = interval === "quarterly" ? "quarterly" : "monthly";
  const credit = preview.chargeToday > 0 ? " after credit for your current plan" : "";
  return `Switch to ${nextLabel}, billed ${billed}, now. ${today}${credit}, ${then}.${legacy}`;
}

export function changeButtonLabel(preview: ChangePreview): string {
  if (preview.kind === "downgrade") return `Downgrade on ${shortDate(preview.effectiveAt)}`;
  return preview.kind === "upgrade" ? "Upgrade now" : "Switch now";
}

export function changeDoneText(preview: ChangePreview, nextLabel: string): string {
  if (preview.kind === "downgrade") {
    return `Scheduled. Your plan changes to ${nextLabel} on ${shortDate(preview.effectiveAt)}. We emailed you the details.`;
  }
  return `Done. You're on ${nextLabel} now.`;
}

const ERROR_TEXT: Record<string, string> = {
  NO_CHANGE: "This is your current plan.",
  SWAP_NOT_SUPPORTED:
    "Swapping one extension for another is coming soon. Keep your current extensions to change plans.",
  INVALID_EXTENSIONS: "Pick the extensions for this plan.",
  CHANGE_PENDING: "You already have a plan change scheduled.",
  CANCEL_SCHEDULED: "Your plan is set to cancel. Resume it from Manage billing first.",
  NOT_ACTIVE: "Plan changes are paused while a payment is overdue.",
  NO_SUBSCRIPTION: "We couldn't find an active plan on this account.",
  NO_PENDING_CHANGE: "There's no scheduled change to undo.",
  PADDLE_REJECTED:
    "We couldn't change your plan right now. If your renewal is less than an hour away, try again after it.",
  UNAUTHENTICATED: "Sign in again to change your plan.",
};

export function changeErrorText(code: string | undefined): string {
  return (code && ERROR_TEXT[code]) || "Something went wrong. Try again.";
}
