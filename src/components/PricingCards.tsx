"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { HeroInstallSplit } from "./HeroInstallSplit";
import { IconCheckCircle, IconCoffee } from "./icons";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";
import { canStartSubscribe } from "@/lib/legal";
import { startPaddleCheckout } from "@/lib/paddle-checkout";
import {
  MONTHLY_AMOUNT,
  YEARLY_AMOUNT,
  canStartCheckout,
  defaultPricingInterval,
  formatPrice,
  pricingCardOrder,
  pricingIntervalTabs,
  pricingProCta,
  yearlyDiscountPercent,
  type BillingInterval,
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

function SlotPrice({ value, slotId }: { value: string; slotId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);
  const [spin, setSpin] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    clearLegacySlotCache();

    const persistSlot = slotId !== "yearly";
    const skipMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (persistSlot && hasPlayedSlot(slotId));

    if (skipMotion) {
      setArmed(false);
      setSpin(false);
      return;
    }

    setArmed(true);
    setSpin(false);

    function play() {
      setSpin(true);
      if (persistSlot) markSlotPlayed(slotId);
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
  }, [slotId]);

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

type Interval = BillingInterval;

const FREE_FEATURES = [
  "Listing metrics: date, salary, applicants",
  "Copy JD and save",
  "Local Kanban board",
  "CSV export",
  "Resume stays in the browser",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Hide / Unhide job cards",
  "ATS score results",
  "Indeed and Seek together",
  "Score a resume against the JD",
];

const PRO_BADGE = "Skip one coffee. Get Pro.";

export function PricingCards({
  monthlyPriceId,
  yearlyPriceId,
  subscribedInterval,
  isAuthenticated,
}: {
  monthlyPriceId: string;
  yearlyPriceId: string;
  subscribedInterval: Interval | null;
  isAuthenticated: boolean;
}) {
  const [interval, setInterval] = useState<Interval>(() =>
    defaultPricingInterval(subscribedInterval),
  );
  const cardOrder = pricingCardOrder(isAuthenticated);
  const intervalTabs = pricingIntervalTabs(subscribedInterval);
  const [pending, setPending] = useState(false);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [error, setError] = useState("");
  const toggleRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });
  const yearlyOff = yearlyDiscountPercent();
  const proPrice =
    interval === "monthly"
      ? formatPrice(MONTHLY_AMOUNT)
      : formatPrice(YEARLY_AMOUNT);
  const proPeriod = interval === "monthly" ? "Monthly" : "Yearly";
  const priceId = interval === "monthly" ? monthlyPriceId : yearlyPriceId;
  const cta = pricingProCta({
    subscribedInterval,
    selectedInterval: interval,
    pending,
  });

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
  }, [interval, subscribedInterval, yearlyOff]);

  function onToggleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setInterval((current) => (current === "monthly" ? "yearly" : "monthly"));
  }

  async function subscribe() {
    if (!canStartCheckout(subscribedInterval, interval)) return;
    setError("");
    if (!canStartSubscribe(agreedToLegal)) {
      setError("Please agree to the Terms of Service and Refund Policy.");
      return;
    }
    setPending(true);
    try {
      const result = await startPaddleCheckout(priceId);
      if (result.status === "login") {
        window.location.href = "/signup?next=/pricing";
        return;
      }
      if (result.status === "error") {
        setError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

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
        {intervalTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="radio"
            aria-checked={interval === tab}
            className="pricing-toggle-option"
            onClick={() => setInterval(tab)}
          >
            {tab === "monthly" ? "Monthly" : "Yearly"}
            {tab === "yearly" && yearlyOff > 0 ? (
              <span className="pricing-toggle-save">-{yearlyOff}%</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 grid w-full items-stretch gap-5 md:w-[90%] md:grid-cols-12">
        {cardOrder.map((card) =>
          card === "free" ? (
            <article key="free" className="pricing-card md:col-span-6">
              <div className="pricing-card-head pricing-card-head-free">
                <h2 className="text-[17px] font-medium tracking-tight">Free</h2>
                <p className="pricing-card-price tabular-nums">
                  <span>$0</span>
                  <span className="pricing-card-period">/forever</span>
                </p>
                <div className="pricing-card-rule" aria-hidden="true" />
                <p className="pricing-card-tagline">
                  Track Indeed and Seek without paying. Metrics, save, and a local
                  board.
                </p>
                <HeroInstallSplit
                  variant="fill"
                  buttonClassName="pricing-card-cta pricing-card-cta-secondary"
                  seekUrl={SEEK_CWS_URL}
                  indeedUrl={INDEED_CWS_URL}
                />
              </div>
              <ul className="pricing-card-features">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature}>
                    <IconCheckCircle className="pricing-card-check" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            <article key="pro" className="pricing-card md:col-span-6">
              <div className="pricing-card-head pricing-card-head-pro">
                <div className="pricing-card-title">
                  <h2 className="text-[17px] font-medium tracking-tight">Pro</h2>
                  <div
                    className={
                      interval === "monthly"
                        ? "pricing-card-badge-slot is-in"
                        : "pricing-card-badge-slot"
                    }
                    aria-hidden={interval !== "monthly"}
                  >
                    <span className="pricing-card-badge">
                      <IconCoffee className="pricing-card-badge-icon" />
                      {PRO_BADGE}
                    </span>
                  </div>
                </div>
                <p className="pricing-card-price tabular-nums">
                  <SlotPrice key={interval} value={proPrice} slotId={interval} />
                  <span className="pricing-card-period">
                    <span key={proPeriod} className="pricing-card-period-text">
                      /{proPeriod}
                    </span>
                  </span>
                </p>
                <div className="pricing-card-rule" aria-hidden="true" />
                <p className="pricing-card-tagline">
                  Best for people who want to hide listings and score a resume
                  against the JD.
                </p>
                <button
                  type="button"
                  className={
                    cta.label === "Subscribed"
                      ? "pricing-card-cta is-subscribed"
                      : "pricing-card-cta"
                  }
                  data-price-id={priceId}
                  disabled={cta.disabled}
                  onClick={subscribe}
                >
                  {cta.label}
                </button>
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
                        <Link
                          href="/terms"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/refunds"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Refund Policy
                        </Link>
                        .
                      </span>
                    </label>
                    {error ? (
                      <p
                        id="pricing-legal-error"
                        className="pricing-legal-error"
                        role="alert"
                      >
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
                {PRO_FEATURES.map((feature) => (
                  <li key={feature}>
                    <IconCheckCircle className="pricing-card-check" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ),
        )}
      </div>
    </div>
  );
}
