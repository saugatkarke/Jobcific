"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { avatarBodyColor, inlineAvatarSvg } from "@/lib/avatar-svg";
import { IconUser } from "./icons";

export type AvatarMotion = "none" | "hover" | "once";

const svgCache = new Map<string, Promise<string>>();

function loadSvg(src: string) {
  let svg = svgCache.get(src);
  if (!svg) {
    svg = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`avatar ${res.status}`);
      return res.text();
    });
    svg.catch(() => svgCache.delete(src));
    svgCache.set(src, svg);
  }
  return svg;
}

// Page CSS cannot reach inside an <img>, so animated avatars are inlined once fetched.
function useInlineSvg(src: string | null, enabled: boolean) {
  const suffix = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [inline, setInline] = useState<{ src: string; markup: string } | null>(
    null,
  );

  useEffect(() => {
    if (!src || !enabled) return;
    let cancelled = false;
    loadSvg(src)
      .then((svg) => {
        if (!cancelled) setInline({ src, markup: inlineAvatarSvg(svg, suffix) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, enabled, suffix]);

  return inline?.src === src ? inline.markup : null;
}

export function useAvatarColor(src: string | null, known: string | null = null) {
  const [loaded, setLoaded] = useState<{
    src: string;
    color: string | null;
  } | null>(null);

  useEffect(() => {
    if (!src || known) return;
    let cancelled = false;
    loadSvg(src)
      .then((svg) => {
        if (!cancelled) setLoaded({ src, color: avatarBodyColor(svg) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, known]);

  if (known) return known;
  return loaded?.src === src ? loaded.color : null;
}

function useSeenOnce(enabled: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, seen };
}

// Each new replay token remounts the SVG so its one-shot animation plays again.
function useReplay(token: number, seen: boolean, ready: boolean) {
  const [run, setRun] = useState(0);
  const playing = useRef(false);

  useEffect(() => {
    if (seen && ready) playing.current = true;
  }, [seen, ready]);

  useEffect(() => {
    if (!token || !ready || playing.current) return;
    playing.current = true;
    setRun((count) => count + 1);
  }, [token, ready]);

  return {
    run,
    onAnimationEnd: () => {
      playing.current = false;
    },
  };
}

export function UserAvatar({
  src,
  size,
  motion = "none",
  replay = 0,
  framed = true,
  className = "",
}: {
  src: string | null;
  size: number;
  motion?: AvatarMotion;
  replay?: number;
  framed?: boolean;
  className?: string;
}) {
  const markup = useInlineSvg(src, motion !== "none");
  const { ref, seen } = useSeenOnce(motion === "once");
  const { run, onAnimationEnd } = useReplay(
    motion === "once" ? replay : 0,
    seen,
    Boolean(markup),
  );
  const motionClass =
    motion === "hover"
      ? "avatar-motion-hover"
      : motion === "once" && (seen || run > 0)
        ? "avatar-motion-once"
        : "";

  return (
    <span
      ref={ref}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${framed ? "border border-[var(--line)] bg-neutral-50" : ""} ${motionClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      onAnimationEnd={onAnimationEnd}
      aria-hidden
    >
      {markup ? (
        <span
          key={run}
          className="user-avatar-svg"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ) : src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full"
        />
      ) : (
        <IconUser className="h-1/2 w-1/2 text-[var(--muted)]" />
      )}
    </span>
  );
}
