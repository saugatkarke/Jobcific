"use client";

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";

export function BtnSpinner() {
  return <span className="btn-spinner" aria-hidden />;
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

export function PendingNavButton({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const targetPath = href.split("?")[0];

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending || undefined}
      className={className}
      onClick={async () => {
        if (pending || pathname === targetPath) return;
        await paintPending(() => setPending(true));
        router.push(href);
      }}
    >
      {pending ? <BtnSpinner /> : null}
      {children}
    </button>
  );
}
