import type { ReactNode } from "react";
import { Caveat } from "next/font/google";
import { PendingLink } from "@/components/BusyButton";
import { ProBorderSpin } from "@/components/ProBorderSpin";
import { FaqAccordion } from "@/components/FaqAccordion";
import { FeatureBento } from "@/components/FeatureBento";
import {
  IconDownload,
  IconExternal,
  IconShield,
  IconUser,
} from "@/components/icons";
import { HeroInstallSplit } from "@/components/HeroInstallSplit";
import { MarketingShell } from "@/components/MarketingShell";
import { MeshHero } from "@/components/MeshHero";
import { GridBand } from "@/components/PageGrid";
import { Reveal } from "@/components/Reveal";
import { SupportedMarkets } from "@/components/SupportedMarkets";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";

const noteFont = Caveat({
  subsets: ["latin"],
  weight: "500",
});

export default function HomePage() {
  return (
    <MarketingShell>
      <ProBorderSpin />
      <GridBand as="section" className="border-b border-[var(--line)]">
        <MeshHero>
          <div className="mx-auto max-w-5xl px-5 pb-16 pt-16 text-center md:px-6 md:pb-20">
            <h1 className="hero-enter hero-enter-2 text-4xl font-bold tracking-tight md:text-6xl">
              Built for <span className="italic">serious job</span> searches
              <br />
              on Indeed and Seek.
            </h1>
            <p className="hero-enter hero-enter-3 mx-auto mt-5 max-w-xl text-[var(--muted)]">
              The salary is buried. The publish date is buried.
            </p>
            <p className="hero-enter hero-enter-3 mx-auto mt-3 max-w-xl italic text-[var(--muted)]">
              Jobcific reveals both, plus how many people already applied and
              how your resume scores.
            </p>
            <div className="hero-cta hero-enter hero-enter-4 mt-8">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <PendingLink
                  href="/pricing"
                  className="btn-primary btn-pro gap-1.5"
                  pendingLabel="Getting Pro..."
                >
                  <ProCrystal />
                  Get Pro
                </PendingLink>
                <div className="hero-install-anchor">
                  <HeroInstallSplit
                    seekUrl={SEEK_CWS_URL}
                    indeedUrl={INDEED_CWS_URL}
                  />
                  <div className="hero-nosignup-callout">
                    <svg
                      className="hero-nosignup-arrow"
                      viewBox="0 0 160 70"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M148 16C108 52 26 62 26 30"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <path
                        d="M19.3 38.1L26 28L32.7 38.1"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="miter"
                      />
                    </svg>
                    <p className={`hero-nosignup ${noteFont.className}`}>
                      No sign up needed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MeshHero>
      </GridBand>

      <GridBand
        as="section"
        id="features"
        className="border-b border-[var(--line)]"
      >
        <Reveal className="col-span-12 px-5 pt-10 md:px-6 md:pt-12">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Features
          </p>
          <h2 className="mt-2 max-w-lg text-3xl font-bold tracking-tight">
            See the listing. Track the search.
          </h2>
        </Reveal>
        <Reveal
          delay={80}
          className="col-span-12 px-5 pb-12 pt-8 md:px-6 md:pb-16"
        >
          <FeatureBento />
        </Reveal>
      </GridBand>

      <GridBand as="section" className="border-b border-[var(--line)]">
        <div className="trust-band col-span-12 flex justify-center px-5 py-5 md:px-6">
          <SupportedMarkets />
        </div>
      </GridBand>

      <GridBand as="section" className="border-b border-[var(--line)]">
        <Reveal className="col-span-12 px-5 py-10 md:px-6 md:py-12">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        </Reveal>
        <Reveal
          delay={0}
          className="col-span-12 border-t border-[var(--line)] md:col-span-4"
        >
          <FeatureItem
            icon={<IconDownload className="h-5 w-5" />}
            title="1. Install free"
            body="Load the Indeed or Seek Chrome extension and keep tracking jobs locally."
            actions={
              <>
                <StoreLink href={SEEK_CWS_URL} label="Seek" />
                <StoreLink href={INDEED_CWS_URL} label="Indeed" />
              </>
            }
          />
        </Reveal>
        <Reveal
          delay={80}
          className="col-span-12 border-t border-[var(--line)] md:col-span-4 md:border-l"
        >
          <FeatureItem
            icon={<IconUser className="h-5 w-5" />}
            title="2. Sign in here"
            body="Create an email account. The popup Sign in connects the extension later."
            actions={
              <PendingLink
                href="/signup"
                className="btn-secondary"
                pendingLabel="Signing up..."
              >
                Sign Up
              </PendingLink>
            }
          />
        </Reveal>
        <Reveal
          delay={160}
          className="col-span-12 border-t border-[var(--line)] md:col-span-4 md:border-l"
        >
          <FeatureItem
            icon={<IconShield className="h-5 w-5" />}
            title="3. Choose your Plan"
            body="Monthly or yearly overlay checkout. We never store card numbers."
            actions={
              <PendingLink
                href="/pricing"
                className="btn-primary btn-pro gap-1.5"
                pendingLabel="Getting Pro..."
              >
                <ProCrystal />
                Get Pro
              </PendingLink>
            }
          />
        </Reveal>
      </GridBand>

      <GridBand as="section" className="border-b border-[var(--line)]">
        <Reveal className="col-span-12 px-5 py-10 md:col-span-4 md:px-6 md:py-12">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to know before you start
          </h2>
        </Reveal>
        <Reveal
          delay={80}
          className="col-span-12 border-t border-[var(--line)] md:col-span-8 md:border-l md:border-t-0"
        >
          <FaqAccordion />
        </Reveal>
      </GridBand>

      <GridBand
        as="section"
        className="mesh-cta border-b border-[var(--line)] text-white"
      >
        <div className="col-span-12 px-5 py-14 md:col-span-8 md:px-6 md:py-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Apply for your dream job with clarity
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <PendingLink
              href="/pricing"
              className="btn-primary btn-pro gap-1.5"
              pendingLabel="Getting Pro..."
            >
              <ProCrystal />
              Get Pro
            </PendingLink>
            <PendingLink
              href="/signup"
              className="btn-secondary border-white/25 bg-transparent text-white hover:bg-white/10"
              pendingLabel="Signing up..."
            >
              Create account
            </PendingLink>
          </div>
        </div>
      </GridBand>
    </MarketingShell>
  );
}

function ProCrystal() {
  return (
    <img
      src="/pro-crystal.png"
      alt=""
      width={145}
      height={256}
      draggable={false}
      className="pro-cta-crystal"
    />
  );
}

function FeatureItem({
  icon,
  title,
  body,
  actions,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <div className="h-full px-5 py-10 md:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex shrink-0 text-[#20FC8F]">{icon}</span>
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      {actions ? (
        <div className="mt-5 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

function StoreLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary gap-1.5 px-3 py-2 text-xs"
    >
      {label}
      <IconExternal className="h-3.5 w-3.5" />
    </a>
  );
}
