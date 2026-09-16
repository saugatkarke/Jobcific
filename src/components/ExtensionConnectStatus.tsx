"use client";

import { useEffect, useState } from "react";

type ConnectStatus = "connecting" | "waiting" | "error";

export function ExtensionConnectStatus() {
  const [status, setStatus] = useState<ConnectStatus>("connecting");

  useEffect(() => {
    const root = document.documentElement;

    function syncExtensionStatus() {
      if (root.getAttribute("data-jt-connect-status") === "error") {
        setStatus("error");
      }
    }

    syncExtensionStatus();
    const observer = new MutationObserver(syncExtensionStatus);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-jt-connect-status"],
    });

    const timeout = window.setTimeout(() => {
      setStatus((current) =>
        current === "connecting" ? "waiting" : current,
      );
    }, 5000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  function retryConnection() {
    setStatus("connecting");
    window.location.reload();
  }

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className="mt-6 rounded-[4px] border border-[var(--line)] bg-white p-4"
    >
      {status === "connecting" ? (
        <div className="flex items-center gap-3">
          <span className="btn-spinner text-[var(--ink)]" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Connecting your extension…</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Keep this tab open while Jobcific confirms your access.
            </p>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
