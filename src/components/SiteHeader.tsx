"use client";

import Link from "next/link";
import { GridBand } from "./PageGrid";
import { IconLogout, IconStar } from "./icons";
import { BtnSpinner, PendingLink } from "./BusyButton";
import { Logo } from "./Logo";
import { useSession } from "./SessionProvider";
import { Skeleton, SkeletonBlock } from "./Skeleton";
import { UserAvatar } from "./UserAvatar";
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

function HeaderSessionSkeleton() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading account
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
        <Skeleton>Your name</Skeleton>
      </span>
      <span className="flex shrink-0 items-center p-1">
        <SkeletonBlock className="h-6 w-6 shrink-0" />
      </span>
    </>
  );
}

export function SiteHeader() {
  const { email, name, avatar, loading, signingOut, signOut } = useSession();

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
        {loading ? (
          <HeaderSessionSkeleton />
        ) : email ? (
          <>
            <Link
              href="/account"
              aria-label={name ? `${name}, account` : "Account"}
              className="flex min-w-0 items-center gap-2 text-neutral-700 transition-colors duration-200 hover:text-black"
            >
              <UserAvatar
                src={avatar}
                size={36}
                motion="hover"
                framed={false}
              />
              <span className="max-w-[8rem] truncate md:max-w-[14rem]">
                {name || "Account"}
              </span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-busy={signingOut || undefined}
              aria-label="Sign out"
              title="Sign out"
              className="flex shrink-0 items-center p-1 text-red-800 transition-colors duration-200 hover:text-red-950"
            >
              {signingOut ? (
                <BtnSpinner size="1.5rem" />
              ) : (
                <IconLogout className="h-6 w-6 shrink-0" />
              )}
            </button>
          </>
        ) : (
          <>
            <HeaderRating />
            <PendingLink
              href="/login"
              pendingLabel="Logging in..."
              className="inline-flex items-center gap-1.5 text-sm text-neutral-700 transition-colors duration-200 hover:text-black"
            >
              Login
            </PendingLink>
            <PendingLink
              href="/signup"
              pendingLabel="Getting started..."
              className="btn-primary whitespace-nowrap px-3 py-2 text-xs md:px-4 md:py-2.5 md:text-sm"
            >
              Get started
            </PendingLink>
          </>
        )}
      </div>
    </GridBand>
  );
}
