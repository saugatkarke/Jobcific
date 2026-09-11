import { MarketingShell } from "@/components/MarketingShell";
import { PricingCards } from "@/components/PricingCards";
import { GridBand } from "@/components/PageGrid";
import { Reveal } from "@/components/Reveal";
import { monthlyPriceId, yearlyPriceId } from "@/lib/pricing";
import { currentProBillingInterval } from "@/lib/session-entitlement";
import { headers } from "next/headers";

export default async function PricingPage() {
  const subscribedInterval = await currentProBillingInterval(await headers());
  return (
    <MarketingShell>
      <GridBand as="section" className="border-b border-[var(--line)]">
        <div className="col-span-12 px-5 py-12 md:col-span-8 md:px-6 md:py-16">
          <p className="hero-enter hero-enter-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Pricing
          </p>
          <h1 className="hero-enter hero-enter-3 mt-2 text-4xl font-bold tracking-tight">
            Hide jobs you don&apos;t want.
            <br /> Score the ones you do.
          </h1>
        </div>
      </GridBand>
      <GridBand as="section" className="border-b border-[var(--line)]">
        <Reveal className="col-span-12">
          <PricingCards
            monthlyPriceId={monthlyPriceId()}
            yearlyPriceId={yearlyPriceId()}
            subscribedInterval={subscribedInterval}
          />
        </Reveal>
      </GridBand>
    </MarketingShell>
  );
}
