import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("account portal", () => {
  const page = readFileSync("src/app/account/page.tsx", "utf8");
  const client = readFileSync("src/components/AccountClient.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");

  it("uses a solid dashboard title", () => {
    expect(page).toContain("Your dashboard");
    expect(page).not.toContain("text-gradient-mint-gold");
  });

  it("renders the welcome line in muted grey", () => {
    expect(client).toContain(
      'className="text-lg font-medium text-[var(--muted)]"',
    );
  });

  it("places the extension card above the feature card in the right column", () => {
    expect(page).toContain("AccountPlanCard");
    expect(page).not.toContain("AccountExtensionCard");
    expect(page).not.toContain("AccountNextSteps");
    expect(client).not.toContain("export function AccountNextSteps");
    expect(client).toContain("export function AccountExtensionCard");
    expect(client).toContain("Then search as usual");
    expect(client).toContain("JOB_BOARD_LINKS");
    const accountClient = client.slice(client.indexOf("export function AccountClient"));
    expect(accountClient.indexOf("<AccountExtensionCard")).toBeLessThan(
      accountClient.indexOf("<DashboardCard"),
    );
  });

  it("places account actions below the plan card in the left column", () => {
    expect(page).toContain("AccountDetailsCard");
    const rendered = page.slice(page.indexOf("return"));
    expect(rendered.indexOf("<AccountDetailsCard")).toBeGreaterThan(
      rendered.indexOf("<AccountPlanCard"),
    );
    const accountClient = client.slice(client.indexOf("export function AccountClient"));
    expect(accountClient).not.toContain('title="Account"');
  });

  it("offers a Connect extension action through /extension/prepare", () => {
    expect(client).toContain("Connect extension");
    expect(client).toContain("EXTENSION_CONNECT_HREF");
    expect(client).toContain("SEEK_CWS_URL");
    expect(client).toContain("INDEED_CWS_URL");
  });

  it("labels the Pro feature list as Core Features", () => {
    expect(client).toContain('isPro ? "Core Features" : "Free features"');
    expect(client).not.toContain('isPro ? "Pro features" : "Free features"');
  });

  it("shows extension success only for the connected query state", () => {
    expect(page).toContain("extension?: string");
    expect(page).toContain('extension === "connected"');
    expect(page).toContain("Extension connected: Pro features are ready.");
  });

  it("styles the plan as a branded Jobcific access panel", () => {
    expect(client).toContain("plan-card-pro");
    expect(client).toContain("Jobcific access");
    expect(client).toContain("Being PRO");
    expect(client).toContain("plan-card-main");
    expect(client).toContain("plan-card-copy-group");
    expect(client).toContain("plan-card-action");
    expect(client).toContain("plan-card-status");
    expect(client).not.toContain("plan-card-orbit");
    expect(client).not.toContain("plan-card-orbit-core");
    expect(client).not.toContain("plan-card-features");
    const planStart = client.indexOf('className={isPro ? "plan-card-pro"');
    const planEnd = client.indexOf("</div>", client.indexOf("plan-card-foot"));
    const plan = client.slice(planStart, planEnd);
    expect(plan.indexOf("Manage billing")).toBeLessThan(
      plan.indexOf("plan-card-foot"),
    );
  });

  it("uses the branded ribbon graphic from the bottom-left at 45 degrees", () => {
    const graphic = readFileSync("public/jobcific-plan-ribbons.svg", "utf8");
    expect(graphic).toContain("<svg");
    expect(graphic).toContain("<path");
    expect(css).toContain('url("/jobcific-plan-ribbons.svg")');
    expect(css).toContain("transform: rotate(45deg)");
    expect(css).toContain("transform-origin: 50% 100%");
    expect(css).not.toContain("background-size: 16px 16px");
  });

  it("places gold at the top-right and mint at the bottom-left", () => {
    expect(css).toMatch(
      /\.plan-card-pro \{[\s\S]*?90% 110% at 100% 0%,\s*rgba\(253, 184, 51/,
    );
    expect(css).toMatch(
      /\.plan-card-pro \{[\s\S]*?70% 90% at 0% 100%,\s*rgba\(32, 252, 143/,
    );
  });

  it("uses a glass border for both plans and ribbons only for Pro", () => {
    expect(css).toContain(".plan-card-pro::before");
    expect(css).toContain(".plan-card-free::before");
    expect(css).toContain("mask-composite: exclude");
    expect(css).toContain(".plan-card-pro::after");
    expect(css).not.toContain(".plan-card-free::after");
    expect(css).toMatch(
      /\.plan-card-free \{[\s\S]*?linear-gradient\([\s\S]*?rgba\(32, 252, 143[\s\S]*?rgba\(253, 184, 51/,
    );
  });
});
