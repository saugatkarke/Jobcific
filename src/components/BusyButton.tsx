"use client";

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";

const SPINNER_TICKS = 30;
const SPINNER_OUTER_RADIUS = 11.5;
/* Must match the btn-spinner-shimmer duration in globals.css. */
const SPINNER_SHIMMER_MS = 1600;
const round = (n: number) => Math.round(n * 100) / 100;

/* Tick i sits i steps counterclockwise from the head at 12 o'clock: hairlines at
   9, thick at 6, tapering to dots around 3, then growing back into the head. */
const spinnerTicks = Array.from({ length: SPINNER_TICKS }, (_, i) => {
  const t = i / SPINNER_TICKS;
  const scale = Math.min(1, Math.abs(t - 0.75) / 0.2);
  const width = (0.3 + 1.2 * Math.abs(Math.cos(2 * Math.PI * t))) * scale;
  const length = Math.max(0, 5.4 * scale - width);
  const opacity = t > 0.75 ? 0.9 : 0.4 + 0.6 * Math.max(0, 1 - t / 0.08);
  return {
    angle: round((-360 * i) / SPINNER_TICKS),
    y1: round(12 - SPINNER_OUTER_RADIUS + width / 2),
    y2: round(12 - SPINNER_OUTER_RADIUS + width / 2 + length),
    width: round(width),
    style: {
      "--tick-opacity": round(opacity),
      animationDelay: `${Math.round(-(1 - t) * SPINNER_SHIMMER_MS)}ms`,
    } as CSSProperties,
  };
}).filter((tick) => tick.width > 0.05);

export function BtnSpinner({ size }: { size?: string }) {
  return (
    <svg
      className="btn-spinner"
      viewBox="0 0 24 24"
      style={size ? { width: size, height: size } : undefined}
      aria-hidden
    >
      {spinnerTicks.map((tick) => (
        <line
          key={tick.angle}
          className="btn-spinner-tick"
          style={tick.style}
          x1="12"
          x2="12"
          y1={tick.y1}
          y2={tick.y2}
          stroke="currentColor"
          strokeWidth={tick.width}
          strokeLinecap="round"
          transform={`rotate(${tick.angle} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Back/forward cache restores the page exactly as it was left, spinner included. */
export function usePageShowReset(setBusy: (busy: boolean) => void) {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setBusy(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [setBusy]);
}

export async function paintPending(show: () => void) {
  flushSync(show);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function holdBusy(startedAt: number, minMs = 500) {
  const wait = minMs - (Date.now() - startedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export function BusyButton({
  busy,
  busyLabel,
  children,
  className = "btn-primary w-full gap-2",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean;
  busyLabel: string;
}) {
  return (
    <button
      {...props}
      className={className}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
    >
      {busy ? <BtnSpinner /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}

function opensInPlace(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.currentTarget.target !== "_blank"
  );
}

export function PendingLink({
  href,
  pendingLabel,
  onClick,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  href: string;
  pendingLabel?: string;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const targetPath = href.split(/[?#]/)[0];

  useEffect(() => {
    setPending(false);
  }, [pathname]);
  usePageShowReset(setPending);

  return (
    <Link
      {...props}
      href={href}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (pending) {
          event.preventDefault();
          return;
        }
        if (event.defaultPrevented || !opensInPlace(event)) return;
        if (targetPath === pathname) return;
        setPending(true);
      }}
    >
      {pending ? <BtnSpinner /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Link>
  );
}
