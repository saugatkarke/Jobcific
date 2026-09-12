import Link from "next/link";
import { DISCLAIMER } from "@/lib/copy";
import { LEGAL_PAGES } from "@/lib/legal";
import { FooterWhackAMole } from "./FooterWhackAMole";
import { GridBand } from "./PageGrid";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <GridBand as="footer" className="footer-dots border-t border-[var(--line)]">
      <FooterWhackAMole />
      <div className="col-span-12 px-4 py-10 md:col-span-3">
        <div className="flex items-center">
          <Logo />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Track Indeed and Seek applications locally. Upgrade here for Hide jobs
          and ATS results.
        </p>
      </div>
      <div className="col-span-6 border-t border-[var(--line)] px-4 py-10 md:col-span-3 md:border-t-0 md:border-l">
        <p className="text-sm font-medium">Product</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          <li>
            <Link href="/#features" className="hover:text-black">
              Features
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="hover:text-black">
              Pricing
            </Link>
          </li>
        </ul>
      </div>
      <div className="col-span-6 border-t border-l border-[var(--line)] px-4 py-10 md:col-span-3 md:border-t-0">
        <p className="text-sm font-medium">Account</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          <li>
            <Link href="/login" className="hover:text-black">
              Login
            </Link>
          </li>
          <li>
            <Link href="/signup" className="hover:text-black">
              Sign up
            </Link>
          </li>
          <li>
            <Link href="/account" className="hover:text-black">
              Account
            </Link>
          </li>
        </ul>
      </div>
      <div className="col-span-12 border-t border-[var(--line)] px-4 py-10 md:col-span-3 md:border-t-0 md:border-l">
        <p className="text-sm font-medium">Legal</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          {LEGAL_PAGES.map((page) => (
            <li key={page.href}>
              <Link href={page.href} className="hover:text-black">
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="col-span-12 border-t border-[var(--line)] px-4 py-4 text-center text-xs text-[var(--muted)]">
        {DISCLAIMER}
      </p>
    </GridBand>
  );
}
