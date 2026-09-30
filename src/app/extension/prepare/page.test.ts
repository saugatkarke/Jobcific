import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("extension prepare page", () => {
  const src = readFileSync("src/app/extension/prepare/page.tsx", "utf8");
  const statusPath = "src/components/ExtensionConnectStatus.tsx";

  it("redirects unsigned users to login and marks signed-in users connect-ready", () => {
    expect(src).toContain("/extension/prepare");
    expect(src).toContain("data-jt-connect-ready");
    expect(src).toContain("Connect your Jobcific extension");
    expect(src).not.toContain("Connect Job Track AU:NZ");
    expect(src).not.toContain("Seek");
  });

  it("shows progress and offers recovery when connection stalls or fails", () => {
    expect(existsSync(statusPath)).toBe(true);
    if (!existsSync(statusPath)) return;

    const status = readFileSync(statusPath, "utf8");
    expect(src).toContain("ExtensionConnectStatus");
    expect(status).toContain("Connecting your extension");
    expect(status).toContain("Connection is taking longer than expected");
    expect(status).toContain("Retry connection");
    expect(status).toContain("Connection could not be completed");
    expect(status).toContain("window.location.reload()");
    expect(status).toContain("data-jt-connect-status");
  });

  it("reloads once when no extension bridge answers, then offers installs", () => {
    const status = readFileSync(statusPath, "utf8");
    expect(status).toContain('=== "connecting"');
    expect(status).toContain("DETECT_MS = 3000");
    expect(status).toContain("SLOW_MS = 15000");
    expect(status).toContain("sessionStorage");
    expect(status).toContain("RELOAD_KEY");
    expect(status).toContain("We couldn&apos;t detect the extension");
    expect(status).toContain("SEEK_CWS_URL");
    expect(status).toContain("INDEED_CWS_URL");
  });
});
