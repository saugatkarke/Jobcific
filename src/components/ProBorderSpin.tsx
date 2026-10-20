"use client";

import { useEffect } from "react";

/* One clockwise turn while the pointer is over the button. */
const SPIN_MS = 3500;
/* The rewind to the resting colors is four times faster. */
const RETURN_MS = SPIN_MS / 4;

function readAngle(el: HTMLElement) {
  const value = Number.parseFloat(
    getComputedStyle(el).getPropertyValue("--pro-border-angle"),
  );
  return Number.isFinite(value) ? value : 0;
}

function normalize(angle: number) {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function ProBorderSpin() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cleanups: Array<() => void> = [];

    document.querySelectorAll<HTMLElement>(".btn-pro").forEach((el) => {
      let mode: "idle" | "spin" | "return" = "idle";
      let anim: Animation | null = null;

      function cancel() {
        anim?.cancel();
        anim = null;
      }

      function hold(angle: number) {
        el.style.setProperty("--pro-border-angle", String(angle));
        cancel();
      }

      function spin() {
        if (mode === "spin") return;
        const angle = readAngle(el);
        hold(angle);
        mode = "spin";
        anim = el.animate(
          [
            { "--pro-border-angle": String(angle) },
            { "--pro-border-angle": String(angle + 360) },
          ],
          { duration: SPIN_MS, easing: "linear", iterations: Infinity },
        );
      }

      function settle() {
        if (mode !== "spin") return;
        const angle = normalize(readAngle(el));
        hold(angle);
        if (angle < 0.5) {
          el.style.setProperty("--pro-border-angle", "0");
          mode = "idle";
          return;
        }
        mode = "return";
        const returning = el.animate(
          [
            { "--pro-border-angle": String(angle) },
            { "--pro-border-angle": "0" },
          ],
          {
            duration: (angle / 360) * RETURN_MS,
            easing: "linear",
            fill: "forwards",
          },
        );
        anim = returning;
        returning.finished
          .then(() => {
            if (anim !== returning) return;
            hold(0);
            mode = "idle";
          })
          .catch(() => {});
      }

      function sync() {
        if (el.matches(":hover, :focus-visible")) spin();
        else settle();
      }

      el.addEventListener("pointerenter", sync);
      el.addEventListener("pointerleave", sync);
      el.addEventListener("focus", sync);
      el.addEventListener("blur", sync);
      cleanups.push(() => {
        el.removeEventListener("pointerenter", sync);
        el.removeEventListener("pointerleave", sync);
        el.removeEventListener("focus", sync);
        el.removeEventListener("blur", sync);
        cancel();
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
