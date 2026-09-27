"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  checkoutNotice,
  needsEntitlementFetch,
  planStatusLabel,
  type AccountEntitlement,
} from "@/lib/account-entitlement";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";
import {
  EXTENSION_CONNECT_HREF,
  JOB_BOARD_LINKS,
} from "@/lib/portal-next-steps";
import {
  IconBloom,
  IconCheckCircle,
  IconExternal,
  IconEyeOff,
  IconLogout,
  IconPencil,
  IconScan,
  IconShield,
  IconXCircle,
} from "./icons";
import { AvatarPicker } from "./AvatarPicker";
import { ChromeMark } from "./HeroInstallSplit";
import {
  BtnSpinner,
  BusyButton,
  PendingLink,
  usePageShowReset,
} from "./BusyButton";
import { useSession } from "./SessionProvider";
import { Skeleton, SkeletonBlock } from "./Skeleton";
import { UserAvatar, useAvatarColor } from "./UserAvatar";

export type AccountViewer = {
  name: string | null;
  email: string | null;
  avatar: string | null;
  avatarColor?: string | null;
};

type AccountState = {
  ent: AccountEntitlement | null;
  notice: string;
  viewer: AccountViewer | null;
};

const AccountContext = createContext<AccountState>({
  ent: null,
  notice: "",
  viewer: null,
});

function useAccount() {
  return useContext(AccountContext);
}

export function AccountProvider({
  checkoutSuccess,
  initialEntitlement,
  viewer,
  children,
}: {
  checkoutSuccess: boolean;
  initialEntitlement: AccountEntitlement | null;
  viewer: AccountViewer | null;
  children: ReactNode;
}) {
  const [ent, setEnt] = useState(initialEntitlement);
  const shouldFetch = needsEntitlementFetch(
    checkoutSuccess,
    initialEntitlement,
  );

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    let retry: number | undefined;
    async function load(attempt = 0) {
      try {
        const res = await fetch("/api/me/entitlement");
        const data = (await res.json()) as AccountEntitlement;
        if (cancelled) return;
        setEnt({
          plan: data.plan,
          status: data.status,
          interval: data.interval ?? null,
        });
        if (checkoutSuccess && data.plan !== "pro" && attempt < 6) {
          retry = window.setTimeout(() => load(attempt + 1), 1500);
        }
      } catch {
        if (!cancelled) {
          setEnt((current) => current ?? { plan: "free", status: "none" });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [checkoutSuccess, shouldFetch]);

  return (
    <AccountContext.Provider
      value={{ ent, notice: checkoutNotice(checkoutSuccess, ent), viewer }}
    >
      {children}
    </AccountContext.Provider>
  );
}

function useViewer() {
  const session = useSession();
  const { viewer } = useAccount();
  return {
    name: viewer?.name || session.name,
    email: viewer?.email || session.email,
    avatar: session.avatar || viewer?.avatar || null,
    loading: !viewer && session.loading,
  };
}

function DashboardCard({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-5">
      <h3 className="text-sm font-medium text-[var(--muted)]">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function AccountWelcome() {
  const { name, email, loading } = useViewer();
  const label = name || email;

  return (
    <div className="mt-6 flex items-center gap-3">
      <span className="inline-block origin-[70%_80%] animate-[wave_1.5s_ease-in-out]">
        👋
      </span>
      <p className="text-lg font-medium text-[var(--muted)]">
        {label ? (
          `Welcome back, ${label}`
        ) : loading ? (
          <>
            Welcome back, <Skeleton>your name</Skeleton>
          </>
        ) : (
          "Welcome back"
        )}
      </p>
    </div>
  );
}

export function AccountPlanCard() {
  const { ent, notice, viewer } = useAccount();
  const { signOut, signingOut, setAvatar } = useSession();
  const { name, email, avatar, loading } = useViewer();
  const avatarColor = useAvatarColor(
    avatar,
    viewer?.avatar === avatar ? (viewer?.avatarColor ?? null) : null,
  );
  const [picking, setPicking] = useState(false);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [portalError, setPortalError] = useState("");
  usePageShowReset(setOpeningBilling);
  const [avatarReplay, setAvatarReplay] = useState(0);
  const [avatarLocked, setAvatarLocked] = useState(false);

  useEffect(() => {
    if (!avatarLocked) return;
    const timer = window.setTimeout(() => setAvatarLocked(false), 3000);
    return () => window.clearTimeout(timer);
  }, [avatarLocked]);

  async function manageBilling() {
    setPortalError("");
    setOpeningBilling(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setPortalError("No billing customer yet. Upgrade first.");
        setOpeningBilling(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError("Could not open billing. Try again.");
      setOpeningBilling(false);
    }
  }

  if (!ent) return <AccountPlanCardSkeleton />;

  const isPro = ent.plan === "pro";
  const status = ent.status && ent.status !== "none" ? ent.status : "active";

  return (
    <div>
      <div
        className={`plan-card-stack ${isPro ? "plan-card-stack-pro" : "plan-card-stack-free"}`}
      >
        <div
          className={isPro ? "plan-card-pro" : "plan-card-free"}
          onMouseEnter={() => setAvatarReplay((count) => count + 1)}
        >
          {isPro ? <PlanAurora /> : null}
          <div className="plan-card-head">
            <div className="plan-card-identity">
              <div className="plan-card-avatar">
                {loading && !avatar ? (
                  <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
                ) : (
                  <UserAvatar
                    src={avatar}
                    size={56}
                    motion="once"
                    replay={avatarReplay}
                  />
                )}
                {isPro ? (
                  <button
                    type="button"
                    className="plan-card-avatar-edit"
                    onClick={() => setPicking((open) => !open)}
                    aria-expanded={picking}
                    aria-label="Edit avatar"
                    title="Edit avatar"
                  >
                    <IconPencil className="h-3 w-3 shrink-0" />
                    Avatar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="plan-card-avatar-edit"
                    onClick={() => setAvatarLocked(true)}
                    data-locked={avatarLocked || undefined}
                    title="Upgrade to Pro to edit"
                    aria-live="polite"
                  >
                    {avatarLocked ? (
                      "Upgrade to Pro to edit"
                    ) : (
                      <>
                        <IconPencil className="h-3 w-3 shrink-0" />
                        Avatar
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <p className="plan-card-title">
                  {isPro ? "You're a PRO" : "Being Free"}
                </p>
                {name ? <p className="plan-card-name">{name}</p> : null}
                <div className="plan-card-email-row">
                  {email ? (
                    <p className="plan-card-email">{email}</p>
                  ) : loading ? (
                    <p className="plan-card-email">
                      <Skeleton>name@example.com</Skeleton>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="plan-card-signout"
                    onClick={signOut}
                    disabled={signingOut}
                    aria-busy={signingOut || undefined}
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    {signingOut ? (
                      <BtnSpinner size="0.875rem" />
                    ) : (
                      <IconLogout className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="plan-card-side">
              <span className="plan-card-status">
                {isPro ? (
                  <IconBloom
                    className="plan-card-bloom"
                    gradientId="plan-status-bloom"
                  />
                ) : (
                  <span className="plan-card-dot" aria-hidden />
                )}
                {planStatusLabel(ent)}
              </span>
              {isPro ? (
                <BusyButton
                  type="button"
                  className="btn-secondary"
                  busy={openingBilling}
                  busyLabel="Opening billing..."
                  onClick={manageBilling}
                >
                  Manage billing
                </BusyButton>
              ) : (
                <PendingLink
                  href="/pricing"
                  className="btn-primary"
                  pendingLabel="Upgrading..."
                >
                  Upgrade to Pro
                </PendingLink>
              )}
            </div>
          </div>
          {notice ? <p className="plan-card-copy">{notice}</p> : null}
        </div>
        {isPro ? (
          <p
            className="plan-card-tray"
            style={
              avatarColor
                ? ({ "--plan-tray-color": avatarColor } as CSSProperties)
                : undefined
            }
          >
            <IconShield className="h-3.5 w-3.5 shrink-0" />
            {`Pro is ${status} on this account.`}
          </p>
        ) : null}
      </div>
      {portalError ? (
        <p className="mt-3 text-sm text-red-400">{portalError}</p>
      ) : null}
      {isPro && picking ? (
        <AvatarPicker
          current={avatar}
          onSaved={(url) => {
            setAvatar(url);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

function PlanAurora() {
  return (
    <div className="plan-aurora" aria-hidden>
      <span className="plan-aurora-wave plan-aurora-wave-1" />
      <span className="plan-aurora-wave plan-aurora-wave-2" />
      <span className="plan-aurora-wave plan-aurora-wave-3" />
    </div>
  );
}

function AccountPlanCardSkeleton() {
  return (
    <div className="plan-card-stack" aria-busy="true">
      <div className="plan-card-free">
        <span className="sr-only">Loading your plan</span>
        <div className="plan-card-head">
          <div className="plan-card-identity">
            <div className="plan-card-avatar">
              <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
              <span className="plan-card-avatar-edit skeleton" aria-hidden>
                Avatar
              </span>
            </div>
            <div className="min-w-0">
              <p className="plan-card-title">
                <Skeleton>Being Free</Skeleton>
              </p>
              <p className="plan-card-name">
                <Skeleton>Your name</Skeleton>
              </p>
              <div className="plan-card-email-row">
                <p className="plan-card-email">
                  <Skeleton>name@example.com</Skeleton>
                </p>
                <SkeletonBlock className="h-6 w-6 shrink-0" />
              </div>
            </div>
          </div>
          <div className="plan-card-side">
            <span className="plan-card-status">
              <IconBloom
                className="plan-card-bloom"
                gradientId="plan-status-bloom-loading"
              />
              <Skeleton>current</Skeleton>
            </span>
            <span className="btn-primary skeleton skeleton-block" aria-hidden>
              Upgrade to Pro
            </span>
          </div>
        </div>
      </div>
      <p className="plan-card-tray">
        <SkeletonBlock className="h-3.5 w-3.5 shrink-0" />
        <Skeleton>Free tracking on Seek and Indeed.</Skeleton>
      </p>
    </div>
  );
}

export function AccountExtensionCard() {
  const { ent } = useAccount();
  const isFree = ent?.plan === "free";

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
        <PendingLink
          href={EXTENSION_CONNECT_HREF}
          className={isFree ? "btn-secondary" : "btn-primary"}
          pendingLabel="Connecting..."
        >
          {ent?.plan === "pro" ? <ChromeMark /> : null}
          Connect extension
        </PendingLink>
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

const FREE_UNAVAILABLE = ["Hide / Unhide job cards", "ATS score results"];

export function AccountClient() {
  const { ent } = useAccount();
  const isPro = ent?.plan === "pro";

  return (
    <div className="space-y-8">
      <AccountExtensionCard />

      {/* What you get */}
      <DashboardCard
        title={
          ent ? (
            isPro ? "Core Features" : "Free features"
          ) : (
            <Skeleton>Free features</Skeleton>
          )
        }
      >
        <ul className="space-y-2.5">
          {ent && !isPro
            ? FREE_UNAVAILABLE.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 text-sm text-[var(--muted)]"
                >
                  <IconXCircle className="h-4 w-4 text-red-600" />
                  <span>{feature}</span>
                </li>
              ))
            : null}
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
          ) : !ent ? (
            <>
              <li className="flex items-center gap-2.5 text-sm">
                <SkeletonBlock className="h-4 w-4" />
                <Skeleton>Hide / Unhide job cards</Skeleton>
              </li>
              <li className="flex items-center gap-2.5 text-sm">
                <SkeletonBlock className="h-4 w-4" />
                <Skeleton>ATS score results</Skeleton>
              </li>
            </>
          ) : null}
        </ul>
      </DashboardCard>
    </div>
  );
}
