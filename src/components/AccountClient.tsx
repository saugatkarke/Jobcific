"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";
import {
  EXTENSION_CONNECT_HREF,
  JOB_BOARD_LINKS,
} from "@/lib/portal-next-steps";
import {
  IconCheckCircle,
  IconExternal,
  IconEyeOff,
  IconScan,
  IconUser,
} from "./icons";
import { useSession } from "./SessionProvider";

type Entitlement = {
  authenticated: boolean;
  email: string | null;
  plan: "pro" | "free";
  status: string;
};

function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-5">
      <h3 className="text-sm font-medium text-[var(--muted)]">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function AccountWelcome() {
  const { name, email } = useSession();

  return (
    <div className="mt-6 flex items-center gap-3">
      <span className="inline-block origin-[70%_80%] animate-[wave_1.5s_ease-in-out]">
        👋
      </span>
      <p className="text-lg font-medium text-[var(--muted)]">
        Welcome back, {name || email || "…"}
      </p>
    </div>
  );
}

export function AccountPlanCard({
  checkoutSuccess,
}: {
  checkoutSuccess: boolean;
}) {
  const { ent, notice, manageBilling, portalError } =
    useEntitlement(checkoutSuccess);
  const isPro = ent?.plan === "pro";
  const status =
    ent?.status && ent.status !== "none"
      ? ent.status
      : isPro
        ? "active"
        : "current";

  return (
    <div>
      <div className={isPro ? "plan-card-pro" : "plan-card-free"}>
        <div className="plan-card-head">
          <p className="plan-card-kicker">Jobcific access</p>
          <span className="plan-card-status">
            <span aria-hidden />
            {status}
          </span>
        </div>
        <div className="plan-card-main">
          <div className="plan-card-copy-group">
            <p className="plan-card-title">
              {isPro ? "Being PRO" : "Being Free"}
            </p>
            <p className="plan-card-copy">
              {notice ||
                (isPro
                  ? `Pro is ${status} on this account.`
                  : "Free tracking on Seek and Indeed.")}
            </p>
          </div>
          <div className="plan-card-action">
            {isPro ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={manageBilling}
              >
                Manage billing
              </button>
            ) : (
              <Link href="/pricing" className="btn-primary">
                Upgrade to Pro
              </Link>
            )}
          </div>
        </div>
        <div className="plan-card-foot">
          <strong>{isPro ? "PRO" : "FREE"}</strong>
          <span>Seek + Indeed</span>
        </div>
      </div>
      {portalError ? (
        <p className="mt-3 text-sm text-red-400">{portalError}</p>
      ) : null}
    </div>
  );
}

function useEntitlement(checkoutSuccess: boolean) {
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [notice, setNotice] = useState(
    checkoutSuccess ? "Payment received. Pro unlocks in a moment." : "",
  );
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load(attempt = 0) {
      const res = await fetch("/api/me/entitlement");
      const data = (await res.json()) as Entitlement;
      if (cancelled) return;
      setEnt(data);
      if (checkoutSuccess && data.plan !== "pro" && attempt < 6) {
        window.setTimeout(() => load(attempt + 1), 1500);
      } else if (checkoutSuccess && data.plan === "pro") {
        setNotice("");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [checkoutSuccess]);

  async function manageBilling() {
    setPortalError("");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setPortalError("No billing customer yet. Upgrade first.");
      return;
    }
    window.location.href = data.url;
  }

  return { ent, notice, portalError, manageBilling };
}

export function AccountExtensionCard() {
  return (
    <DashboardCard title="Chrome extension">
      <p className="text-sm">
        Connect this account so Pro status syncs into the Seek and Indeed
        extensions.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Chrome opens a small window to finish the link. Then reopen the
        extension popup.
      </p>
      <div className="mt-4">
        <Link href={EXTENSION_CONNECT_HREF} className="btn-primary">
          Connect extension
        </Link>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Then search as usual on Seek Australia, Seek New Zealand, or Indeed.
      </p>
      <ul className="mt-3 space-y-2">
        {JOB_BOARD_LINKS.map((board) => (
          <li key={board.href}>
            <a
              href={board.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2.5 text-sm font-medium hover:bg-neutral-50"
            >
              {board.label}
              <IconExternal className="h-3.5 w-3.5 text-[var(--muted)]" />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Need the extension first?{" "}
        <a
          href={SEEK_CWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-black hover:underline"
        >
          Install Seek
        </a>
        {" · "}
        <a
          href={INDEED_CWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-black hover:underline"
        >
          Install Indeed
        </a>
      </p>
    </DashboardCard>
  );
}

export function AccountDetailsCard() {
  const { email, signOut } = useSession();

  return (
    <DashboardCard title="Account">
      <div className="flex items-center gap-3 text-sm">
        <IconUser className="h-4 w-4 text-[var(--muted)]" />
        <span>{email || "…"}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </DashboardCard>
  );
}

export function AccountClient({
  checkoutSuccess,
}: {
  checkoutSuccess: boolean;
}) {
  const { ent } = useEntitlement(checkoutSuccess);
  const isPro = ent?.plan === "pro";

  return (
    <div className="space-y-8">
      <AccountExtensionCard />

      {/* What you get */}
      <DashboardCard title={isPro ? "Core Features" : "Free features"}>
        <ul className="space-y-2.5">
          <li className="flex items-center gap-2.5 text-sm">
            <IconCheckCircle className="h-4 w-4 text-[var(--mint)]" />
            <span>Job metrics and tracking</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm">
            <IconCheckCircle className="h-4 w-4 text-[var(--mint)]" />
            <span>Copy JD and Save to board</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm">
            <IconCheckCircle className="h-4 w-4 text-[var(--mint)]" />
            <span>Local Kanban board</span>
          </li>
          {isPro ? (
            <>
              <li className="flex items-center gap-2.5 text-sm">
                <IconEyeOff className="h-4 w-4 text-[var(--mint)]" />
                <span>Hide / Unhide job cards</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm">
                <IconScan className="h-4 w-4 text-[var(--mint)]" />
                <span>ATS score results</span>
              </li>
            </>
          ) : null}
        </ul>
        {!isPro ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Upgrade to unlock Hide jobs and ATS scores.
          </p>
        ) : null}
      </DashboardCard>
    </div>
  );
}
