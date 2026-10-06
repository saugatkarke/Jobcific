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

const SPINNER_SEGMENTS = 12;
/* Must match the btn-spinner-segment duration in globals.css. */
const SPINNER_CYCLE_MS = 1100;

/* Segment i sits i steps clockwise from 12 o'clock and lights up i steps later,
   so the flare travels clockwise. Each segment is 180deg symmetric, which lets
   its own half-turn loop seamlessly. */
const spinnerSegments = Array.from({ length: SPINNER_SEGMENTS }, (_, i) => ({
  angle: (360 * i) / SPINNER_SEGMENTS,
  style: {
    animationDelay: `${Math.round(((i - SPINNER_SEGMENTS) / SPINNER_SEGMENTS) * SPINNER_CYCLE_MS)}ms`,
  } as CSSProperties,
}));

export function BtnSpinner({ size }: { size?: string }) {
  return (
    <svg
      className="btn-spinner"
      viewBox="0 0 24 24"
      style={size ? { width: size, height: size } : undefined}
      aria-hidden
    >
      {spinnerSegments.map((segment) => (
        <g key={segment.angle} transform={`rotate(${segment.angle} 12 12)`}>
          <rect
            className="btn-spinner-segment"
            style={segment.style}
            x="11"
            y="1.5"
            width="2"
            height="4.2"
            rx="1"
            fill="currentColor"
          />
        </g>
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
  reloadDocument = false,
  onClick,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  href: string;
  pendingLabel?: string;
  /** Chrome only injects extension content scripts on full document loads. */
  reloadDocument?: boolean;
}) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const targetPath = href.split(/[?#]/)[0];

  useEffect(() => {
    setPending(false);
  }, [pathname]);
  usePageShowReset(setPending);

  const linkProps = {
    href,
    "aria-busy": pending || undefined,
    "aria-disabled": pending || undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (pending) {
        event.preventDefault();
        return;
      }
      if (event.defaultPrevented || !opensInPlace(event)) return;
      if (!reloadDocument && targetPath === pathname) return;
      setPending(true);
    },
  };
  const content = (
    <>
      {pending ? <BtnSpinner /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </>
  );

  if (reloadDocument) {
    const { className, style, target, rel, id, title } = props;
    return (
      <a {...{ className, style, target, rel, id, title }} {...linkProps}>
        {content}
      </a>
    );
  }

  return (
    <Link {...props} {...linkProps}>
      {content}
    </Link>
  );
}
