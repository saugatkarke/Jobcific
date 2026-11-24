"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  planLabel,
  planSummary,
  type AccountEntitlement,
} from "@/lib/account-entitlement";
import { EXTENSIONS, normalizeExtensionPicks, type ExtensionClient } from "@/lib/extensions";
import {
  changeButtonLabel,
  changeDoneText,
  changeErrorText,
  changeSummaryText,
  shortDate,
  type ChangePreview,
} from "@/lib/plan-change-copy";
import {
  formatPrice,
  planForPickCount,
  type CheckoutInterval,
  type PlanPriceIds,
} from "@/lib/pricing";
import { useAccountEntitlement } from "./AccountClient";
import { BusyButton } from "./BusyButton";
import { ExtensionPick } from "./ExtensionPick";
import { IconClose } from "./icons";

const PREVIEW_DELAY_MS = 250;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const noopSubscribe = () => () => {};

export function PlanChangeSheet({
  open,
  onClose,
  priceIds,
}: {
  open: boolean;
  onClose: () => void;
  priceIds: PlanPriceIds;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [rendered, setRendered] = useState(false);
  if (open && !rendered) setRendered(true);
  if (!isClient || !rendered) return null;
  return createPortal(
    <SheetFrame
      closing={!open}
      onClose={onClose}
      onClosed={() => setRendered(false)}
      priceIds={priceIds}
    />,
    document.body,
  );
}

function SheetFrame({
  closing,
  onClose,
  onClosed,
  priceIds,
}: {
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
  priceIds: PlanPriceIds;
}) {
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    sheet.current?.focus();
    return () => {
      root.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const items = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="plan-sheet-root" data-state={closing ? "closed" : "open"}>
      <div className="plan-sheet-backdrop" aria-hidden onClick={onClose} />
      <div
        ref={sheet}
        className="plan-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-plan-title"
        tabIndex={-1}
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) onClosed();
        }}
      >
        <div className="plan-sheet-grabber" aria-hidden />
        <div className="plan-sheet-head">
          <h2 id="change-plan-title" className="text-xl font-semibold tracking-tight">
            Change plan
          </h2>
          <button
            type="button"
            className="plan-sheet-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <SheetContent priceIds={priceIds} />
      </div>
    </div>
  );
}

function SheetContent({ priceIds }: { priceIds: PlanPriceIds }) {
  const { ent, refresh } = useAccountEntitlement();
  const [done, setDone] = useState("");
  if (!ent || ent.plan !== "pro" || !ent.planId) {
    return <Note>Plan changes are available on Pro plans.</Note>;
  }

  const formKey = [
    ent.planId,
    ent.interval,
    (ent.extensions ?? []).join(","),
    ent.scheduledChange?.effectiveAt ?? "",
  ].join("|");

  return (
    <>
      {done ? (
        <p
          role="status"
          className="mb-4 rounded-[4px] border border-[var(--mint)] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          {done}
        </p>
      ) : null}
      <PanelBody key={formKey} ent={ent} priceIds={priceIds} refresh={refresh} onDone={setDone} />
    </>
  );
}

function PanelBody({
  ent,
  priceIds,
  refresh,
  onDone,
}: {
  ent: AccountEntitlement;
  priceIds: PlanPriceIds;
  refresh: () => Promise<void>;
  onDone: (text: string) => void;
}) {
  if (ent.scheduledChange) {
    return <ScheduledNotice ent={ent} refresh={refresh} onDone={onDone} />;
  }
  if (ent.cancelAtPeriodEnd) {
    return (
      <Note>
        Your plan is set to cancel at the end of this period. Resume it from Manage billing to
        change plans.
      </Note>
    );
  }
  if (ent.status !== "active" && ent.status !== "trialing") {
    return (
      <Note>
        Plan changes are paused while a payment is overdue. Update your payment method from Manage
        billing.
      </Note>
    );
  }
  return <ChangeForm ent={ent} priceIds={priceIds} refresh={refresh} onDone={onDone} />;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}

function ScheduledNotice({
  ent,
  refresh,
  onDone,
}: {
  ent: AccountEntitlement;
  refresh: () => Promise<void>;
  onDone: (text: string) => void;
}) {
  const scheduled = ent.scheduledChange!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = planSummary(ent);

  async function keepPlan() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/change-plan", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(changeErrorText(data.error));
        setBusy(false);
        return;
      }
      onDone(`Done. You're staying on ${current}.`);
      await refresh();
    } catch {
      setError(changeErrorText(undefined));
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm">
        Your plan changes to{" "}
        <strong>{planLabel(scheduled.planId, scheduled.extensions)}</strong> on{" "}
        {shortDate(scheduled.effectiveAt)}. Until then you keep {current}.
      </p>
      <div className="mt-4">
        <BusyButton
          type="button"
          className="btn-secondary w-full"
          busy={busy}
          busyLabel="Keeping your plan..."
          onClick={keepPlan}
        >
          Keep my current plan
        </BusyButton>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PreviewState =
  | { status: "idle"; message: string }
  | { status: "loading" }
  | { status: "ready"; preview: ChangePreview }
  | { status: "error"; message: string };

function sameSet(a: readonly ExtensionClient[], b: readonly ExtensionClient[]) {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function ChangeForm({
  ent,
  priceIds,
  refresh,
  onDone,
}: {
  ent: AccountEntitlement;
  priceIds: PlanPriceIds;
  refresh: () => Promise<void>;
  onDone: (text: string) => void;
}) {
  const currentPicks = normalizeExtensionPicks(ent.extensions ?? []);
  const currentInterval: CheckoutInterval = ent.interval === "monthly" ? "monthly" : "quarterly";
  const [picks, setPicks] = useState<ExtensionClient[]>(currentPicks);
  const [interval, setInterval] = useState<CheckoutInterval>(
    ent.interval === "yearly" ? "quarterly" : currentInterval,
  );
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    message: "Pick extensions or a billing period to see what changes.",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const plan = planForPickCount(picks.length);
  const priceId = priceIds[plan.id][interval];
  const nextLabel = planLabel(plan.id, picks);

  function requestPreview(nextPicks: ExtensionClient[], nextInterval: CheckoutInterval) {
    if (timer.current) clearTimeout(timer.current);
    requestId.current += 1;
    setError("");
    if (nextPicks.length === 0) {
      setState({ status: "idle", message: "Pick at least one extension." });
      return;
    }
    if (sameSet(nextPicks, currentPicks) && nextInterval === ent.interval) {
      setState({ status: "idle", message: "This is your current plan." });
      return;
    }
    const id = requestId.current;
    const nextPlan = planForPickCount(nextPicks.length);
    setState({ status: "loading" });
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/billing/change-plan/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            priceId: priceIds[nextPlan.id][nextInterval],
            extensions: nextPicks,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as ChangePreview & { error?: string };
        if (id !== requestId.current) return;
        if (!res.ok) {
          setState({ status: "error", message: changeErrorText(data.error) });
          return;
        }
        setState({ status: "ready", preview: data });
      } catch {
        if (id === requestId.current) {
          setState({ status: "error", message: changeErrorText(undefined) });
        }
      }
    }, PREVIEW_DELAY_MS);
  }

  function togglePick(client: ExtensionClient) {
    const next = picks.includes(client)
      ? picks.filter((pick) => pick !== client)
      : [...picks, client];
    setPicks(next);
    requestPreview(next, interval);
  }

  function chooseInterval(next: CheckoutInterval) {
    setInterval(next);
    requestPreview(picks, next);
  }

  async function confirm() {
    if (state.status !== "ready") return;
    const preview = state.preview;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId, extensions: picks }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(changeErrorText(data.error));
        setPending(false);
        return;
      }
      onDone(changeDoneText(preview, nextLabel));
      await refresh();
    } catch {
      setError(changeErrorText(undefined));
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-sm">
        Now on <strong>{planSummary(ent)}</strong>
        {ent.legacy ? " at the legacy $4.99 price" : ""}.
      </p>

      <div
        role="radiogroup"
        aria-label="Billing period"
        className="pricing-toggle mt-4"
        style={{ marginInline: 0 }}
      >
        {(["monthly", "quarterly"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="radio"
            aria-checked={interval === tab}
            className="pricing-toggle-option"
            disabled={pending}
            onClick={() => chooseInterval(tab)}
          >
            {tab === "monthly" ? "Monthly" : "Quarterly"}
          </button>
        ))}
      </div>

      <fieldset className="pricing-picks" disabled={pending}>
        <legend className="pricing-picks-legend">Extensions</legend>
        {EXTENSIONS.map((ext) => (
          <ExtensionPick
            key={ext.client}
            name={ext.name}
            checked={picks.includes(ext.client)}
            onToggle={() => togglePick(ext.client)}
          />
        ))}
      </fieldset>

      {picks.length > 0 ? (
        <p className="mt-3 text-sm font-medium">
          {plan.name}: {formatPrice(plan[interval])} {interval === "quarterly" ? "a quarter" : "a month"}
        </p>
      ) : null}

      <p className="mt-2 min-h-[2.5rem] text-sm text-[var(--muted)]" aria-live="polite">
        {state.status === "loading"
          ? "Checking the price..."
          : state.status === "ready"
            ? changeSummaryText({
                preview: state.preview,
                currentLabel: planSummary(ent),
                nextLabel,
                interval,
              })
            : state.message}
      </p>

      <div className="mt-3">
        <BusyButton
          type="button"
          className={`btn-primary plan-sheet-cta w-full${
            state.status === "ready" ? ` plan-sheet-cta-${state.preview.kind}` : ""
          }`}
          busy={pending}
          busyLabel="Changing your plan..."
          disabled={state.status !== "ready"}
          onClick={confirm}
        >
          {state.status === "ready" ? changeButtonLabel(state.preview) : "Change plan"}
        </BusyButton>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
