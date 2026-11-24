import { MarketingShell } from "@/components/MarketingShell";
import { PricingCards } from "@/components/PricingCards";
import { PricingReview } from "@/components/PricingReview";
import { GridBand } from "@/components/PageGrid";
import { Reveal } from "@/components/Reveal";
import { planPriceIds } from "@/lib/pricing";
import { currentPlan } from "@/lib/session-entitlement";
import { getOptionalSession } from "@/lib/session";
import { headers } from "next/headers";

export default async function PricingPage() {
  const requestHeaders = await headers();
  const [current, session] = await Promise.all([
    currentPlan(requestHeaders),
    getOptionalSession(requestHeaders),
  ]);
  return (
    <MarketingShell>
      <GridBand as="section" className="border-b border-[var(--line)]">
        <div className="col-span-12 flex flex-col justify-center px-5 py-12 md:col-span-7 md:px-6 md:py-16">
          <p className="hero-enter hero-enter-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Pricing
          </p>
          <h1 className="hero-enter hero-enter-3 mt-2 text-4xl font-bold tracking-tight">
            Hide jobs you don&apos;t want.
            <br /> Score the ones you do.
          </h1>
        </div>
        <div className="col-span-12 flex flex-col justify-center border-t border-[var(--line)] px-5 py-8 md:col-span-5 md:border-l md:border-t-0 md:px-6 md:py-16">
          <PricingReview />
        </div>
      </GridBand>
      <GridBand as="section" className="border-b border-[var(--line)]">
        <Reveal className="col-span-12">
          <PricingCards
            priceIds={planPriceIds()}
            current={current}
            isAuthenticated={Boolean(session?.user)}
          />
        </Reveal>
      </GridBand>
    </MarketingShell>
  );
}
