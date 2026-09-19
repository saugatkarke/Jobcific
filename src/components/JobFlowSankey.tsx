"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Job = {
  id: string;
  title: string;
  ats: number;
  share: number;
  color: string;
  outcome: string;
};

type Outcome = {
  id: string;
  title: string;
  badge?: string;
  barColor: string;
};

type Ribbon = {
  key: string;
  jobId: string;
  x0: number;
  y0: number;
  h0: number;
  x1: number;
  y1: number;
  h1: number;
};

const JOBS: Job[] = [
  { id: "fe", title: "Frontend Engineer", ats: 72, share: 22, color: "#F472B6", outcome: "interview" },
  { id: "de", title: "Data Engineer", ats: 64, share: 18, color: "#34D399", outcome: "noreply" },
  { id: "pm", title: "Product Manager", ats: 81, share: 24, color: "#A78BFA", outcome: "offer" },
  { id: "ml", title: "ML Engineer", ats: 77, share: 20, color: "#60A5FA", outcome: "interview" },
  { id: "ux", title: "UX Designer", ats: 69, share: 16, color: "#FDB833", outcome: "rejected" },
];

const OUTCOMES: Outcome[] = [
  { id: "interview", title: "Interview", badge: "In pipeline", barColor: "#14B8A6" },
  { id: "offer", title: "Offer", barColor: "#10B981" },
  { id: "noreply", title: "No reply", barColor: "#38BDF8" },
  { id: "rejected", title: "Rejected", barColor: "#7F1D1D" },
];

function outcomeCount(id: string) {
  return JOBS.filter((job) => job.outcome === id).length;
}

function ribbonPath(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number) {
  const mid = (x0 + x1) / 2;
  return `M${x0},${y0}C${mid},${y0} ${mid},${y1} ${x1},${y1}L${x1},${y1 + h1}C${mid},${y1 + h1} ${mid},${y0 + h0} ${x0},${y0 + h0}Z`;
}

function relativeRect(el: HTMLElement, root: HTMLElement) {
  const a = el.getBoundingClientRect();
  const b = root.getBoundingClientRect();
  return {
    x: a.left - b.left,
    y: a.top - b.top,
    w: a.width,
    h: a.height,
  };
}

function sliceHeight(total: number, index: number, count: number) {
  const start = (total * index) / count;
  const end = (total * (index + 1)) / count;
  return { yOffset: start, height: Math.max(end - start, 1) };
}

export function JobFlowSankey() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLElement | null>>({});
  const targetRefs = useRef<Record<string, HTMLElement | null>>({});
  const leftListRef = useRef<HTMLDivElement>(null);
  const rightListRef = useRef<HTMLDivElement>(null);
  const [ribbons, setRibbons] = useState<Ribbon[]>([]);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [hoverJob, setHoverJob] = useState<string | null>(null);
  const [hoverOutcome, setHoverOutcome] = useState<string | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const next: Ribbon[] = [];
      const incomingIndex: Record<string, number> = {};

      for (const job of JOBS) {
        const source = sourceRefs.current[job.id];
        const target = targetRefs.current[job.outcome];
        if (!source || !target) continue;

        const s = relativeRect(source, root);
        const t = relativeRect(target, root);
        const count = outcomeCount(job.outcome);
        const index = incomingIndex[job.outcome] ?? 0;
        incomingIndex[job.outcome] = index + 1;
        const slice = sliceHeight(t.h, index, count);

        next.push({
          key: job.id,
          jobId: job.id,
          x0: s.x + s.w,
          y0: s.y,
          h0: s.h,
          x1: t.x,
          y1: t.y + slice.yOffset,
          h1: slice.height,
        });
      }

      const width = Math.round(root.getBoundingClientRect().width);
      const height = Math.round(root.getBoundingClientRect().height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      setRibbons((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (ribbon, i) =>
              ribbon.key === next[i]?.key &&
              ribbon.x0 === next[i]?.x0 &&
              ribbon.y0 === next[i]?.y0 &&
              ribbon.h0 === next[i]?.h0 &&
              ribbon.x1 === next[i]?.x1 &&
              ribbon.y1 === next[i]?.y1 &&
              ribbon.h1 === next[i]?.h1,
          )
        ) {
          return prev;
        }
        return next;
      });
    };

    measure();
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (leftListRef.current) observer.observe(leftListRef.current);
    if (rightListRef.current) observer.observe(rightListRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const compact = size.width < 520;
  const total = JOBS.length;
  const hovering = hoverJob !== null || hoverOutcome !== null;
  const litOutcome = hoverJob
    ? (JOBS.find((job) => job.id === hoverJob)?.outcome ?? null)
    : hoverOutcome;

  function jobLit(jobId: string) {
    if (!hovering) return null;
    if (hoverJob) return jobId === hoverJob;
    return JOBS.find((job) => job.id === jobId)?.outcome === hoverOutcome;
  }

  function cardTone(lit: boolean | null) {
    if (lit === true) {
      return "bg-[#f7f8fa]";
    }
    if (lit === false) return "opacity-40";
    return "";
  }

  const ease = "transition-[background-color,opacity,filter] duration-300 ease-out delay-75";

  return (
    <div ref={rootRef} className="relative h-full min-h-[280px] w-full overflow-hidden">
      <svg
        className="pointer-events-none absolute inset-0 z-0"
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {[...ribbons]
          .sort((a, b) => Number(jobLit(a.jobId) === true) - Number(jobLit(b.jobId) === true))
          .map((ribbon) => {
          const job = JOBS.find((item) => item.id === ribbon.jobId);
          const lit = jobLit(ribbon.jobId);
          const opacity = lit === true ? 0.48 : lit === false ? 0.05 : 0.17;
          return (
            <path
              key={ribbon.key}
              d={ribbonPath(ribbon.x0, ribbon.y0, ribbon.h0, ribbon.x1, ribbon.y1, ribbon.h1)}
              fill={lit === true ? (job?.color ?? "#7B8B99") : "#7B8B99"}
              fillOpacity={opacity}
              style={{ transition: "fill-opacity 320ms ease-out 80ms, fill 320ms ease-out 80ms" }}
            />
          );
        })}
      </svg>

      <div className="relative z-10 grid h-full min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(2.5rem,0.45fr)_minmax(0,1fr)] gap-1.5 md:grid-cols-[minmax(0,1fr)_minmax(120px,1.2fr)_minmax(0,1fr)] md:gap-3">
        <section className="flex min-h-0 min-w-0 flex-col">
          <p className="shrink-0 text-[12px] font-medium md:text-[13px]">
            <span className="tabular-nums">{total}</span> Saved
          </p>
          <p className="mb-2 shrink-0 text-[10px] text-[var(--muted)]">Roles in your board</p>
          <div
            ref={leftListRef}
            className="grid min-h-0 flex-1 gap-1.5"
            style={{ gridTemplateRows: `repeat(${JOBS.length}, minmax(0, 1fr))` }}
          >
            {JOBS.map((job) => {
              const lit = jobLit(job.id);
              return (
              <article
                key={job.id}
                ref={(el) => {
                  sourceRefs.current[job.id] = el;
                }}
                className={`flex min-h-0 cursor-pointer overflow-hidden rounded-[4px] border border-[var(--line)] bg-white ${ease} ${cardTone(lit)}`}
                onMouseEnter={() => setHoverJob(job.id)}
                onMouseLeave={() => setHoverJob(null)}
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center px-1.5 py-1.5 md:px-2.5">
                  <p className="truncate text-[11px] font-medium leading-tight md:text-xs">{job.title}</p>
                  {compact ? (
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">ATS {job.ats}</p>
                  ) : (
                    <>
                      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-[var(--muted)]">
                        <span>ATS {job.ats}</span>
                        <span className="tabular-nums">{job.share}%</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e4e8ee]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${job.ats}%`, background: job.color }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="h-full w-2.5 shrink-0 self-stretch md:w-3"
                  style={{ background: job.color }}
                />
              </article>
              );
            })}
          </div>
        </section>

        <div className="min-h-0 min-w-0" aria-hidden="true" />

        <section className="flex min-h-0 min-w-0 flex-col">
          <p className="invisible shrink-0 text-[12px] font-medium md:text-[13px]">
            <span className="tabular-nums">{total}</span> Saved
          </p>
          <p className="invisible mb-2 shrink-0 text-[10px]">Roles in your board</p>
          <div
            ref={rightListRef}
            className="grid min-h-0 flex-1 gap-1.5"
            style={{ gridTemplateRows: `repeat(${JOBS.length}, minmax(0, 1fr))` }}
          >
            {OUTCOMES.map((outcome) => {
              const count = outcomeCount(outcome.id);
              const lit = hovering ? litOutcome === outcome.id : null;
              return (
                <article
                  key={outcome.id}
                  ref={(el) => {
                    targetRefs.current[outcome.id] = el;
                  }}
                  className={`flex min-h-0 cursor-pointer overflow-hidden rounded-[4px] border border-[var(--line)] bg-white ${ease} ${cardTone(lit)}`}
                  onMouseEnter={() => setHoverOutcome(outcome.id)}
                  onMouseLeave={() => setHoverOutcome(null)}
                >
                  <div
                    className="h-full w-2 shrink-0 self-stretch md:w-3"
                    style={{ background: outcome.barColor }}
                  />
                  <div
                    className={`flex min-w-0 flex-1 px-1.5 py-1.5 md:px-2.5 ${
                      compact
                        ? "flex-col justify-center gap-0.5"
                        : "items-center justify-between gap-2"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-tight md:text-xs">
                        {outcome.title}
                      </p>
                      {outcome.badge && !compact ? (
                        <span className="mt-1 inline-flex rounded-full bg-[#d9f7ff] px-1.5 py-0.5 text-[9px] font-medium text-[#0f6f86]">
                          {outcome.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className={compact ? "min-w-0" : "shrink-0 text-right"}>
                      <p className="text-[11px] font-medium tabular-nums md:text-xs">
                        {compact ? `${count} ${count === 1 ? "role" : "roles"}` : count}
                      </p>
                      {compact ? null : <p className="text-[9px] text-[var(--muted)]">Roles</p>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
