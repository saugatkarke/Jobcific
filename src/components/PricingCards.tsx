"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { BtnSpinner, usePageShowReset } from "./BusyButton";
import { ExtensionPick } from "./ExtensionPick";
import { HeroInstallSplit } from "./HeroInstallSplit";
import {
  IconCheckCircle,
  IconChevronDown,
  IconCoffee,
  IconIcedCoffee,
  IconMocktail,
  IconXCircle,
} from "./icons";
import { INDEED_CWS_URL, LINKEDIN_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";
import {
  EXTENSIONS,
  normalizeExtensionPicks,
  type ExtensionClient,
} from "@/lib/extensions";
import { canStartSubscribe } from "@/lib/legal";
import { pushBeginCheckout } from "@/lib/gtm";
import { startPaddleCheckout } from "@/lib/paddle-checkout";
import {
  PLANS,
  formatPrice,
  planById,
  planForPickCount,
  proCardCta,
  quarterlyDiscountPercent,
  type CheckoutInterval,
  type CurrentPlan,
  type PlanPriceIds,
} from "@/lib/pricing";

const SLOT_CYCLES = 1;
const SLOT_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SLOT_SESSION_KEY = "jh_price_slot";

function clearLegacySlotCache() {
  try {
    localStorage.removeItem(SLOT_SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    document.cookie = `${SLOT_SESSION_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function hasPlayedSlot(id: string): boolean {
  try {
    return sessionStorage.getItem(`${SLOT_SESSION_KEY}:${id}`) === "1";
  } catch {
    return false;
  }
}

function markSlotPlayed(id: string) {
  try {
    sessionStorage.setItem(`${SLOT_SESSION_KEY}:${id}`, "1");
  } catch {
    // Private mode or blocked storage: skip persistence.
  }
}

/* `persist` limits the page-load spin to once per session; changes from the user always spin. */
function SlotPrice({
  value,
  slotId,
  persist,
}: {
  value: string;
  slotId: string;
  persist: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);
  const [spin, setSpin] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    clearLegacySlotCache();

    const skipMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (persist && hasPlayedSlot(slotId));

    if (skipMotion) {
      setArmed(false);
      setSpin(false);
      return;
    }

    setArmed(true);
    setSpin(false);

    function play() {
      setSpin(true);
      if (persist) markSlotPlayed(slotId);
    }

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.92 && rect.bottom > vh * 0.08) {
      play();
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      play();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [slotId, persist]);

  const className = [
    "price-slot",
    armed ? "is-armed" : "",
    spin ? "is-spinning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{value}</span>
      <span className="price-slot-visual" aria-hidden="true">
        {Array.from(value, (char, index) => {
          const isDigit = char >= "0" && char <= "9";
          const slotTo = isDigit
            ? 1 + SLOT_CYCLES * 10 + Number(char)
            : 1;

          return (
            <span
              key={`${value}-${index}`}
              className={
                isDigit
                  ? "price-slot-reel"
                  : "price-slot-reel price-slot-reel-static"
              }
              style={
                {
                  "--slot-to": slotTo,
                  "--slot-delay": `${index * 49}ms`,
                } as CSSProperties
              }
            >
              <span className="price-slot-strip">
                <span className="price-slot-digit" />
                {isDigit
                  ? Array.from({ length: SLOT_CYCLES + 1 }, (_, cycle) =>
                      SLOT_DIGITS.map((n) => (
                        <span
                          key={`${cycle}-${n}`}
                          className="price-slot-digit"
                        >
                          {n}
                        </span>
                      ))
                    )
                  : (
                    <span className="price-slot-digit">{char}</span>
                  )}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

const ATS_SCORE_FEATURE = "Score a resume against the job description";

const FREE_FEATURES = [
  "Published dates and interest counts on Indeed and Seek",
  "Copy JD and save jobs",
  "Local application board",
  "CSV export and local resume storage",
];

const FREE_UNAVAILABLE = [
  "Hide / Unhide job cards",
  "ATS score results",
  ATS_SCORE_FEATURE,
];

const PRO_FEATURES = ["Hide / Unhide job cards", "ATS score results"];
const ATS_SCORES_PER_MONTH = 1000;

const PLAN_TAGLINES = {
  lens: "Pro on the one job site you use most.",
  bifocal: "Pro on the two job sites you search side by side.",
  panorama: "Pro on Indeed, LinkedIn, and Seek. Nothing hidden.",
} as const;

const DRINK_BADGES = {
  lens: "Skip one latte. Get Pro.",
  bifocal: "Skip one Venti Frappuccino. Get Pro.",
  panorama: "Skip one mocktail. Get Pro.",
} as const;
/* Keep in sync with the `pricing-cta-flash` animation duration in globals.css. */
const FLASH_MS = 1600;

export function PricingCards({
  priceIds,
  current,
  isAuthenticated,
}: {
  priceIds: PlanPriceIds;
  current: CurrentPlan;
  isAuthenticated: boolean;
}) {
  const [interval, setInterval] = useState<CheckoutInterval>("monthly");
  const [touched, setTouched] = useState(false);
  const toggleRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const quarterlyOff = quarterlyDiscountPercent(PLANS[0]);

  useLayoutEffect(() => {
    const root = toggleRef.current;
    if (!root) return;

    function measure(el: HTMLDivElement) {
      const active = el.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!active) return;
      const rootBox = el.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setThumb({
        left: box.left - rootBox.left,
        width: box.width,
      });
    }

    measure(root);
    const observer = new ResizeObserver(() => measure(root));
    observer.observe(root);
    for (const option of root.querySelectorAll("button")) {
      observer.observe(option);
    }
    return () => observer.disconnect();
  }, [interval, quarterlyOff]);

  function chooseInterval(next: CheckoutInterval) {
    setTouched(true);
    setInterval(next);
  }

  function onToggleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    chooseInterval(interval === "monthly" ? "quarterly" : "monthly");
  }

  const freeCard = <FreeCard key="free" />;
  const proCard = (
    <ProCard
      key="pro"
      interval={interval}
      priceIds={priceIds}
      current={current}
      touched={touched}
      onTouch={() => setTouched(true)}
    />
  );

  return (
    <div className="col-span-12 px-5 py-10 md:px-6 md:py-16">
      <div
        ref={toggleRef}
        role="radiogroup"
        aria-label="Billing period"
        className={
          thumb.width > 0 ? "pricing-toggle is-ready" : "pricing-toggle"
        }
        onKeyDown={onToggleKeyDown}
      >
        {thumb.width > 0 ? (
          <span
            className="pricing-toggle-thumb"
            aria-hidden="true"
            style={
              {
                "--thumb-x": `${thumb.left}px`,
                "--thumb-w": `${thumb.width}px`,
              } as CSSProperties
            }
          />
        ) : null}
        {(["monthly", "quarterly"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="radio"
            aria-checked={interval === tab}
            className="pricing-toggle-option"
            onClick={() => chooseInterval(tab)}
          >
            {tab === "monthly" ? "Monthly" : "Quarterly"}
            {tab === "quarterly" && quarterlyOff > 0 ? (
              <span className="pricing-toggle-save">-{quarterlyOff}%</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 grid w-full items-stretch gap-5 md:w-[90%] md:grid-cols-12">
        {isAuthenticated ? [proCard, freeCard] : [freeCard, proCard]}
      </div>
    </div>
  );
}

function FreeCard() {
  return (
    <article className="pricing-card md:col-span-6">
      <div className="pricing-card-head pricing-card-head-free">
        <h2 className="text-[17px] font-medium tracking-tight">Free</h2>
        <p className="pricing-card-price tabular-nums">
          <span>$0</span>
          <span className="pricing-card-period">/forever</span>
        </p>
        <p className="pricing-card-tagline">
          Track every job site without paying. Metrics, save, and a local board.
        </p>
        <HeroInstallSplit
          variant="fill"
          buttonClassName="pricing-card-cta pricing-card-cta-secondary"
          indeedUrl={INDEED_CWS_URL}
          linkedinUrl={LINKEDIN_CWS_URL}
          seekUrl={SEEK_CWS_URL}
        />
      </div>
      <ul className="pricing-card-features">
        {FREE_FEATURES.map((feature) => (
          <li key={feature}>
            <IconCheckCircle className="pricing-card-check" />
            {feature}
          </li>
        ))}
        {FREE_UNAVAILABLE.map((feature) => (
          <li key={feature} className="is-unavailable">
            <IconXCircle className="pricing-card-cross" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ProCard({
  interval,
  priceIds,
  current,
  touched,
  onTouch,
}: {
  interval: CheckoutInterval;
  priceIds: PlanPriceIds;
  current: CurrentPlan;
  touched: boolean;
  onTouch: () => void;
}) {
  const [picks, setPicks] = useState<ExtensionClient[]>(() =>
    current ? normalizeExtensionPicks(current.extensions) : [],
  );
  const [pending, setPending] = useState(false);
  usePageShowReset(setPending);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [includedOpen, setIncludedOpen] = useState(true);
  const [error, setError] = useState("");

  const plan = current ? planById(current.plan) : planForPickCount(picks.length);
  const amount = plan[interval];
  const priceId = priceIds[plan.id][interval];
  const cta = proCardCta({ current, picked: picks.length, pending });
  const locked = Boolean(current) || pending;
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashCount = useRef(0);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);
  const badge = interval === "monthly" ? DRINK_BADGES[plan.id] : "";
  const atsLimit = (
    ATS_SCORES_PER_MONTH * (interval === "quarterly" ? 3 : 1)
  ).toLocaleString("en-US");

  function clearFlash() {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = null;
    setFlash(null);
  }

  function showAddOnHint(count: number) {
    clearFlash();
    if (count < 1 || count >= PLANS.length) return;
    const diff = planForPickCount(count + 1)[interval] - planForPickCount(count)[interval];
    flashCount.current += 1;
    setFlash({
      id: flashCount.current,
      text: `Add another for +${formatPrice(Number(diff.toFixed(2)))}`,
    });
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }

  function togglePick(client: ExtensionClient) {
    onTouch();
    setError("");
    if (picks.includes(client)) {
      clearFlash();
      setPicks(picks.filter((pick) => pick !== client));
      return;
    }
    setPicks([...picks, client]);
    showAddOnHint(picks.length + 1);
  }

  async function subscribe() {
    if (cta.disabled) return;
    clearFlash();
    setError("");
    if (!canStartSubscribe(agreedToLegal)) {
      setError("Please agree to the Terms of Service and Refund Policy.");
      return;
    }
    setPending(true);
    const result = await startPaddleCheckout(priceId, picks);
    if (result.status === "ok") {
      pushBeginCheckout({ interval, plan: plan.id, value: amount });
    }
    if (result.status === "login") {
      window.location.assign("/signup?next=/pricing");
      return;
    }
    if (result.status === "error") {
      setError(result.message);
    }
    setPending(false);
  }

  return (
    <article className="pricing-card md:col-span-6">
      <div className="pricing-card-head pricing-card-head-pro">
        <div className="pricing-card-title">
          <h2 className="text-[17px] font-medium tracking-tight" aria-live="polite">
            Pro{" "}
            <span key={plan.id} className="pricing-card-period-text pricing-plan-name">
              {plan.name}
            </span>
          </h2>
          <div
            className={badge ? "pricing-card-badge-slot is-in" : "pricing-card-badge-slot"}
            aria-hidden={!badge}
          >
            {badge ? (
              <span key={badge} className="pricing-card-badge">
                {plan.id === "panorama" ? (
                  <IconMocktail className="pricing-card-badge-icon" />
                ) : plan.id === "bifocal" ? (
                  <IconIcedCoffee className="pricing-card-badge-icon" />
                ) : (
                  <IconCoffee className="pricing-card-badge-icon" />
                )}
                {badge}
              </span>
            ) : null}
          </div>
        </div>
        <p className="pricing-card-price tabular-nums">
          <SlotPrice
            key={`${plan.id}-${interval}`}
            value={formatPrice(amount)}
            slotId={`pro-${plan.id}-${interval}`}
            persist={!touched}
          />
          <span className="pricing-card-period">
            <span key={interval} className="pricing-card-period-text">
              /{interval === "monthly" ? "Monthly" : "Quarterly"}
            </span>
          </span>
        </p>
        <p className="pricing-card-tagline pricing-card-tagline-fixed">
          <span key={plan.id} className="pricing-card-period-text">
            {PLAN_TAGLINES[plan.id]}
          </span>
        </p>

        <button
          type="button"
          className={current ? "pricing-card-cta is-subscribed" : "pricing-card-cta"}
          data-price-id={priceId}
          disabled={cta.disabled}
          aria-busy={pending || undefined}
          aria-label={cta.label}
          onClick={subscribe}
        >
          {pending ? <BtnSpinner /> : null}
          <span
            key={flash ? `flash-${flash.id}` : cta.label}
            className={flash ? "pricing-cta-label is-flash" : "pricing-cta-label"}
          >
            {flash ? flash.text : cta.label}
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {flash?.text ?? ""}
        </span>

        <fieldset className="pricing-picks" disabled={locked}>
          <legend className="pricing-picks-legend">
            {current ? "Extensions on your plan" : "Choose your extensions"}
          </legend>
          {EXTENSIONS.map((ext) => (
            <ExtensionPick
              key={ext.client}
              name={ext.name}
              checked={picks.includes(ext.client)}
              onToggle={() => togglePick(ext.client)}
            />
          ))}
        </fieldset>
        {current ? (
          <p className="pricing-card-note">
            {current.legacy
              ? "Legacy $4.99 price, kept while you stay on this plan. "
              : ""}
            <Link href="/account?change=plan" className="underline underline-offset-2">
              Change your plan from your account.
            </Link>
          </p>
        ) : null}
        {cta.showLegal ? (
          <div className="pricing-legal-block">
            <label className="pricing-legal">
              <input
                type="checkbox"
                checked={agreedToLegal}
                aria-describedby={error ? "pricing-legal-error" : undefined}
                onChange={(event) => {
                  setAgreedToLegal(event.target.checked);
                  if (event.target.checked) setError("");
                }}
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" onClick={(event) => event.stopPropagation()}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/refunds" onClick={(event) => event.stopPropagation()}>
                  Refund Policy
                </Link>
                .
              </span>
            </label>
            {error ? (
              <p id="pricing-legal-error" className="pricing-legal-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : error ? (
          <p className="pricing-legal-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <ul className="pricing-card-features">
        <li className="pricing-included">
          <button
            type="button"
            className={
              includedOpen ? "pricing-included-toggle is-open" : "pricing-included-toggle"
            }
            aria-expanded={includedOpen}
            aria-controls="pricing-free-included"
            onClick={() => setIncludedOpen((open) => !open)}
          >
            <IconCheckCircle className="pricing-card-check" />
            <span>Everything in Free</span>
            <IconChevronDown className="pricing-included-chevron" />
          </button>
          <div
            id="pricing-free-included"
            className={
              includedOpen ? "pricing-included-panel is-open" : "pricing-included-panel"
            }
            aria-hidden={!includedOpen}
          >
            <div className="pricing-included-clip">
              <ul className="pricing-included-list">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        </li>
        {PRO_FEATURES.map((feature) => (
          <li key={feature}>
            <IconCheckCircle className="pricing-card-check" />
            {feature}
          </li>
        ))}
        <li>
          <IconCheckCircle className="pricing-card-check" />
          <span>
            {ATS_SCORE_FEATURE}
            <sup className="pricing-card-mark">*</sup>
          </span>
        </li>
      </ul>
      <p className="pricing-card-limit">
        * Up to {atsLimit} ATS scores per {interval === "monthly" ? "month" : "quarter"}.
      </p>
    </article>
  );
}
