"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

type HeroInstallSplitProps = {
  indeedUrl: string;
  linkedinUrl: string;
  seekUrl: string;
  variant?: "inline" | "fill";
  buttonClassName?: string;
};

export function HeroInstallSplit({
  indeedUrl,
  linkedinUrl,
  seekUrl,
  variant = "inline",
  buttonClassName,
}: HeroInstallSplitProps) {
  const [open, setOpen] = useState(false);
  const indeedRef = useRef<HTMLAnchorElement>(null);
  const indeedId = useId();
  const linkedinId = useId();
  const seekId = useId();
  const showChrome = variant === "inline";
  const fill = variant === "fill";
  const actionClass = [
    fill ? "" : "btn-secondary",
    buttonClassName,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!open) return;
    indeedRef.current?.focus();
  }, [open]);

  return (
    <div
      className={
        open
          ? `hero-install is-open${fill ? " is-fill" : ""}`
          : `hero-install${fill ? " is-fill" : ""}`
      }
      role="group"
      aria-label="Install Jobcific"
    >
      <div className="hero-install-col hero-install-col-indeed">
        <a
          ref={indeedRef}
          id={indeedId}
          href={indeedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} hero-install-choice`}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
        >
          {showChrome ? <ChromeMark /> : null}
          {fill ? "Indeed" : "Install for Indeed"}
        </a>
      </div>

      <div className="hero-install-col hero-install-col-origin">
        <button
          type="button"
          className={`${actionClass} hero-install-origin`}
          aria-expanded={open}
          aria-controls={`${indeedId} ${linkedinId} ${seekId}`}
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          onClick={() => setOpen(true)}
        >
          {showChrome ? <ChromeMark /> : null}
          Install free
        </button>
      </div>

      <div className="hero-install-col hero-install-col-linkedin">
        <a
          id={linkedinId}
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} hero-install-choice`}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
        >
          {showChrome ? <ChromeMark /> : null}
          {fill ? "LinkedIn" : "Install for LinkedIn"}
        </a>
      </div>

      <div className="hero-install-col hero-install-col-seek">
        <a
          id={seekId}
          href={seekUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${actionClass} hero-install-choice`}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
        >
          {showChrome ? <ChromeMark /> : null}
          {fill ? "Seek" : "Install for Seek"}
        </a>
      </div>
    </div>
  );
}

export function ChromeMark() {
  return (
    <Image
      src="/chrome_logo.webp"
      alt=""
      width={16}
      height={16}
      className="mr-2"
    />
  );
}
