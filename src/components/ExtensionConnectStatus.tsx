"use client";

import { useEffect, useState } from "react";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "@/lib/cws";
import { BtnSpinner } from "./BusyButton";

type ConnectStatus = "connecting" | "waiting" | "missing" | "error";

/* The Indeed bridge only reports after waking its service worker. */
const DETECT_MS = 3000;
const SLOW_MS = 15000;
const RELOAD_KEY = "jt_connect_auto_reload_at";
const RELOAD_WINDOW_MS = 30000;

function reloadedRecently() {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    return at > 0 && Date.now() - at < RELOAD_WINDOW_MS;
  } catch {
    return true;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {}
}

function clearReloaded() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {}
}

export function ExtensionConnectStatus() {
  const [status, setStatus] = useState<ConnectStatus>("connecting");

  useEffect(() => {
    const root = document.documentElement;
    let detected = false;

    function syncExtensionStatus() {
      const value = root.getAttribute("data-jt-connect-status");
      if (!value) return;
      detected = true;
      clearReloaded();
      if (value === "error") {
        setStatus("error");
      } else if (value === "connecting") {
        setStatus((current) => (current === "missing" ? "connecting" : current));
      }
    }

    syncExtensionStatus();
    const observer = new MutationObserver(syncExtensionStatus);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-jt-connect-status"],
    });

    const detectTimeout = window.setTimeout(() => {
      if (detected) return;
      if (!reloadedRecently()) {
        markReloaded();
        window.location.reload();
        return;
      }
      setStatus((current) => (current === "connecting" ? "missing" : current));
    }, DETECT_MS);

    const slowTimeout = window.setTimeout(() => {
      setStatus((current) =>
        current === "connecting" ? "waiting" : current,
      );
    }, SLOW_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(detectTimeout);
      window.clearTimeout(slowTimeout);
    };
  }, []);

  function retryConnection() {
    setStatus("connecting");
    window.location.reload();
  }

  if (status === "connecting") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded-[4px] border border-[var(--line)] bg-white p-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex text-[var(--ink)]">
            <BtnSpinner size="1.5rem" />
          </span>
          <div>
            <p className="text-sm font-medium">Connecting your extension…</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Keep this tab open while Jobcific confirms your access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="mt-6 rounded-[4px] border border-[var(--line)] bg-white p-4"
      >
        <p className="text-sm font-medium">We couldn&apos;t detect the extension.</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Install or enable the Seek or Indeed extension in Chrome, then retry.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={retryConnection}
            className="btn-primary"
          >
            Retry connection
          </button>
          <a
            href={SEEK_CWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Get the Seek extension
          </a>
          <a
            href={INDEED_CWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Get the Indeed extension
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className="mt-6 rounded-[4px] border border-[var(--line)] bg-white p-4"
    >
      <p className="text-sm font-medium">
        {status === "error"
          ? "Connection could not be completed."
          : "Connection is taking longer than expected."}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Reloading safely asks the extension to check your account again.
      </p>
      <button
        type="button"
        onClick={retryConnection}
        className="btn-secondary mt-4"
      >
        Retry connection
      </button>
    </div>
  );
}
