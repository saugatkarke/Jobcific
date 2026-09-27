import type { ReactNode } from "react";

// The inner span stays inline so its fill covers only the glyph height, even inside flex rows.
export function Skeleton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={className} aria-hidden>
      <span className="skeleton">{children}</span>
    </span>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span className={`skeleton skeleton-block ${className}`.trim()} aria-hidden />
  );
}
