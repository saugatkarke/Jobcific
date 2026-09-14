"use client";

import Link from "next/link";
import { GridBand } from "./PageGrid";
import { IconLogout, IconStar, IconUser } from "./icons";
import { PendingNavButton } from "./BusyButton";
import { Logo } from "./Logo";
import { useSession } from "./SessionProvider";
import { APP_NAME } from "@/lib/copy";

function HeaderRating() {
  return (
    <span className="header-rating hidden md:inline-flex" aria-label="5 star rating">
      <span className="header-rating-stars" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="header-rating-star-cell">
            <IconStar
              gradient
              gradientId={`header-star-gradient-${index}`}
              className={
                index === 0
                  ? "header-rating-star header-rating-star--lead"
                  : "header-rating-star"
              }
            />
          </span>
        ))}
      </span>
      <span className="header-rating-label">
        <span className="header-rating-count">5</span>
        <span className="header-rating-copy">star rating</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  const { email, name, signOut } = useSession();

  return (
    <GridBand
      as="header"
      className="header-rule sticky top-0 z-20 bg-white/95 backdrop-blur-sm"
    >
      <div className="col-span-4 flex h-20 items-center gap-6 px-3 md:col-span-7 md:gap-8 md:px-4">
        <Link
          href="/"
          aria-label={APP_NAME}
          className="flex shrink-0 items-center text-sm font-medium"
        >
          <Logo priority />
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-neutral-600 md:flex lg:gap-6">
          <Link
            href="/#features"
            className="whitespace-nowrap transition-colors duration-200 hover:text-black"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="whitespace-nowrap transition-colors duration-200 hover:text-black"
          >
            Pricing
          </Link>
          <Link
            href="/privacy"
            className="whitespace-nowrap transition-colors duration-200 hover:text-black"
          >
            Privacy
          </Link>
        </nav>
      </div>
      <div className="col-span-8 flex h-20 items-center justify-end gap-2 px-3 text-sm md:col-span-5 md:gap-3 md:px-4">
        {email ? (
          <>
            <Link
              href="/account"
              aria-label={name ? `${name}, account` : "Account"}
              className="flex min-w-0 items-center gap-1.5 text-neutral-700 transition-colors duration-200 hover:text-black"
            >
              <IconUser className="h-4 w-4 shrink-0" />
              <span className="hidden truncate md:inline">
                {name || "Account"}
              </span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-neutral-700 transition-colors duration-200 hover:text-black"
            >
              <IconLogout className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </>
        ) : (
          <>
            <HeaderRating />
            <PendingNavButton
              href="/login"
              className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-[inherit] text-sm text-neutral-700 transition-colors duration-200 hover:text-black disabled:opacity-100"
            >
              Login
            </PendingNavButton>
            <PendingNavButton
              href="/signup"
              className="btn-primary whitespace-nowrap px-3 py-2 text-xs md:px-4 md:py-2.5 md:text-sm"
            >
              Get started
            </PendingNavButton>
          </>
        )}
      </div>
    </GridBand>
  );
}
