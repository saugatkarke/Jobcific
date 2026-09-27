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

  it("merges the account details into the plan card", () => {
    expect(page).not.toContain("AccountDetailsCard");
    expect(client).not.toContain("export function AccountDetailsCard");
    expect(client).not.toContain('title="Account"');
    expect(page).toContain("interval: ent.interval");
  });

  it("lays out avatar, identity, and the billing action in one header row", () => {
    const planCard = client.slice(
      client.indexOf("export function AccountPlanCard"),
      client.indexOf("function PlanAurora"),
    );
    const order = [
      'className="plan-card-identity"',
      'className="plan-card-avatar"',
      "<UserAvatar",
      'className="plan-card-avatar-edit"',
      'className="plan-card-title"',
      'className="plan-card-name"',
      'className="plan-card-email-row"',
      'className="plan-card-email"',
      'className="plan-card-signout"',
      'className="plan-card-side"',
      "{planStatusLabel(ent)}",
      "Manage billing",
      'pendingLabel="Upgrading..."',
      "<AvatarPicker",
    ].map((needle) => planCard.indexOf(needle));
    expect(order).not.toContain(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(planCard).not.toContain('aria-label="Change avatar"');
    expect(css).toMatch(/\.plan-card-side \{[\s\S]*?align-items: flex-end;[\s\S]*?justify-content: space-between/);
  });

  it("marks the plan status with a slowly turning brand bloom instead of a dot", () => {
    const icons = readFileSync("src/components/icons.tsx", "utf8");
    expect(icons).toContain("export function IconBloom");
    expect(icons).toMatch(/BLOOM_PETALS = Array\.from\(\{ length: 10 \}/);
    const status = client.slice(client.indexOf('<span className="plan-card-status">'));
    expect(status.indexOf("<IconBloom")).toBeLessThan(status.indexOf("{planStatusLabel(ent)}"));
    expect(client).not.toMatch(/plan-card-status">\s*<span aria-hidden \/>/);
    expect(css).not.toContain(".plan-card-status > span:first-child");
    expect(css).toMatch(/\.plan-card-bloom \{[\s\S]*?animation: plan-bloom-spin 9s linear infinite/);
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.plan-card-bloom,[\s\S]*?animation: none/);
  });

  it("opens the avatar choices from a pencil Avatar button under the avatar", () => {
    const edit = client.slice(
      client.indexOf('className="plan-card-avatar-edit"'),
      client.indexOf("</button>", client.indexOf('className="plan-card-avatar-edit"')),
    );
    expect(edit).toContain("onClick={() => setPicking((open) => !open)}");
    expect(edit).toContain("aria-expanded={picking}");
    expect(edit).toContain('aria-label="Edit avatar"');
    expect(edit).toContain("<IconPencil");
    expect(edit).toMatch(/\/>\s*Avatar\s*$/);
  });

  it("tells Free users to upgrade instead of opening the avatar choices", () => {
    const planCard = client.slice(
      client.indexOf("export function AccountPlanCard"),
      client.indexOf("function PlanAurora"),
    );
    const locked = planCard.slice(
      planCard.indexOf("onClick={() => setAvatarLocked(true)}"),
      planCard.indexOf("</button>", planCard.indexOf("onClick={() => setAvatarLocked(true)}")),
    );
    expect(locked).toContain('"Upgrade to Pro to edit"');
    expect(locked).toContain('aria-live="polite"');
    expect(locked).not.toContain("setPicking");
    expect(planCard).toContain("window.setTimeout(() => setAvatarLocked(false), 3000)");
    expect(planCard).toContain("{isPro && picking ? (");
    expect(css).toMatch(/\.plan-card-avatar-edit\[data-locked\] \{[\s\S]*?white-space: normal/);
    const route = readFileSync("src/app/api/me/avatar/route.ts", "utf8");
    expect(route).toContain('if (ent.plan !== "pro")');
    expect(route).toContain('{ error: "PRO_REQUIRED" }, { status: 403 }');
  });

  it("gives Free a plain charcoal card with a green dot and no aurora or tray", () => {
    const planCard = client.slice(
      client.indexOf("export function AccountPlanCard"),
      client.indexOf("function PlanAurora"),
    );
    expect(planCard).toContain("{isPro ? <PlanAurora /> : null}");
    expect(planCard).toContain('<span className="plan-card-dot" aria-hidden />');
    expect(planCard).not.toContain("Free tracking on Seek and Indeed.");
    expect(client).not.toContain("IconMetrics");
    expect(planCard).toMatch(/\{isPro \? \(\s*<p\s+className="plan-card-tray"/);
    expect(css).toMatch(
      /\.plan-card-free \{\s*padding-bottom: 1\.75rem;\s*background: linear-gradient\(180deg, #202322 0%, #181a19 100%\);\s*\}/,
    );
    expect(css).not.toContain("--plan-glow-opacity: 0.6");
    expect(css).not.toContain(".plan-card-stack-free .plan-card-tray");
    expect(css).not.toContain(".plan-card-free:hover .plan-aurora");
    expect(css).toMatch(/\.plan-card-dot \{[\s\S]*?border-radius: 999px;[\s\S]*?background: var\(--mint\)/);
  });

  it("replays the avatar animation once each time the card is hovered", () => {
    const avatar = readFileSync("src/components/UserAvatar.tsx", "utf8");
    expect(client).toContain("onMouseEnter={() => setAvatarReplay((count) => count + 1)}");
    expect(client).toMatch(/<UserAvatar\s+src=\{avatar\}\s+size=\{56\}\s+motion="once"\s+replay=\{avatarReplay\}/);
    expect(avatar).toContain("function useReplay(");
    expect(avatar).toContain("key={run}");
    expect(avatar).toContain("onAnimationEnd={onAnimationEnd}");
    expect(avatar).toMatch(/motion === "once" && \(seen \|\| run > 0\)/);
  });

  it("offers a Connect extension action through /extension/prepare", () => {
    expect(client).toContain("Connect extension");
    expect(client).toContain('const isFree = ent?.plan === "free";');
    expect(client).toContain('className={isFree ? "btn-secondary" : "btn-primary"}');
    expect(client).toMatch(
      /\{ent\?\.plan === "pro" \? <ChromeMark \/> : null\}\s*Connect extension/,
    );
    expect(client).toContain('import { ChromeMark } from "./HeroInstallSplit";');
    expect(client).toContain("EXTENSION_CONNECT_HREF");
    expect(client).toContain("SEEK_CWS_URL");
    expect(client).toContain("INDEED_CWS_URL");
  });

  it("labels the Pro feature list as Core Features", () => {
    expect(client).toContain('isPro ? "Core Features" : "Free features"');
    expect(client).not.toContain('isPro ? "Pro features" : "Free features"');
  });

  it("leads the Free feature list with crossed-out Pro features", () => {
    expect(client).toContain(
      'const FREE_UNAVAILABLE = ["Hide / Unhide job cards", "ATS score results"];',
    );
    const list = client.slice(client.indexOf('<ul className="space-y-2.5">'));
    expect(list.indexOf("FREE_UNAVAILABLE.map")).toBeLessThan(
      list.indexOf("Job metrics and tracking"),
    );
    expect(list).toContain('<IconXCircle className="h-4 w-4 text-red-600" />');
    expect(client).not.toContain("Upgrade to unlock Hide jobs and ATS scores.");
  });

  it("shows extension success only for the connected query state", () => {
    expect(page).toContain("extension?: string");
    expect(page).toContain('extension === "connected"');
    expect(page).toContain("Extension connected: Pro features are ready.");
  });

  it("styles the plan as a branded panel without the access kicker", () => {
    expect(client).toContain("plan-card-pro");
    expect(client).not.toContain("Jobcific access");
    expect(client).not.toContain("plan-card-kicker");
    expect(css).not.toContain(".plan-card-kicker");
    expect(client).not.toContain("plan-card-main");
    expect(client).not.toContain("plan-card-copy-group");
    expect(client).toContain(`isPro ? "You're a PRO" : "Being Free"`);
    expect(client).not.toContain("Being PRO");
    expect(client).toContain("plan-card-status");
    expect(client).not.toContain("plan-card-orbit");
    expect(client).not.toContain("plan-card-orbit-core");
    expect(client).not.toContain("plan-card-features");
    expect(client).toContain("Manage billing");
    expect(client).not.toContain("plan-card-foot");
    expect(css).not.toContain(".plan-card-foot");
  });

  it("renders Sign out as a labelled red icon beside the email", () => {
    const signout = client.slice(
      client.indexOf('className="plan-card-signout"'),
      client.indexOf("</button>", client.indexOf('className="plan-card-signout"')),
    );
    expect(signout).toContain("onClick={signOut}");
    expect(signout).toContain('aria-label="Sign out"');
    expect(signout).toContain('title="Sign out"');
    expect(signout).toContain('<IconLogout className="h-3.5 w-3.5" />');
    expect(signout.slice(signout.indexOf("<IconLogout"))).not.toContain("Sign out");
    expect(css).toMatch(
      /\.plan-card-signout \{[\s\S]*?border-radius: 8px;[\s\S]*?background: rgba\(250, 247, 240, 0\.64\);[\s\S]*?color: #ef4444/,
    );
    expect(css).toMatch(/\.plan-card-signout:focus-visible \{[\s\S]*?outline: 2px solid/);
    expect(css).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.plan-card-signout \{\s*opacity: 0;\s*pointer-events: none;\s*\}\s*:is\(\.plan-card-pro, \.plan-card-free\):is\(:hover, :focus-within\) \.plan-card-signout \{\s*opacity: 1;/,
    );
    expect(client).not.toContain("btn-danger");
    expect(css).not.toContain(".btn-danger");
  });

  it("lights a dark glass card with an aurora rising from the bottom", () => {
    expect(css).not.toContain("jobcific-plan-ribbons.svg");
    expect(css).toMatch(/\.plan-card-pro,\s*\.plan-card-free \{[\s\S]*?background: linear-gradient\(180deg, #030604/);
    expect(css).toMatch(/\.plan-card-pro \{[\s\S]*?--plan-glow-a: rgba\(32, 252, 143/);
    expect(css).toMatch(/\.plan-card-pro \{[\s\S]*?--plan-glow-b: rgba\(255, 196, 64/);
    expect(css).not.toContain(".plan-card-pro::after");
    expect(css).not.toContain(".plan-card-free::after");
  });

  it("shows the plan status on a brand tray under the access card", () => {
    const planCard = client.slice(
      client.indexOf("export function AccountPlanCard"),
      client.indexOf("function PlanAurora"),
    );
    expect(planCard).toContain('isPro ? "plan-card-stack-pro" : "plan-card-stack-free"');
    const tray = planCard.slice(planCard.indexOf('className="plan-card-tray"'));
    expect(planCard.indexOf('className="plan-card-tray"')).toBeGreaterThan(
      planCard.indexOf("Manage billing"),
    );
    expect(tray).toContain("<IconShield");
    expect(tray).toContain("`Pro is ${status} on this account.`");
    expect(planCard).toContain('{notice ? <p className="plan-card-copy">{notice}</p> : null}');
    expect(css).toMatch(/\.plan-card-stack-pro \.plan-card-tray \{[\s\S]*?var\(--mint\)/);
  });

  it("tints the Pro tray with the avatar's body color, falling back to mint", () => {
    const avatar = readFileSync("src/components/UserAvatar.tsx", "utf8");
    expect(page).toContain("avatarColor: await avatarColorForUrl(avatar).catch(() => null)");
    expect(avatar).toContain("export function useAvatarColor(");
    expect(client).toContain("viewer?.avatar === avatar ? (viewer?.avatarColor ?? null) : null");
    expect(client).toContain('{ "--plan-tray-color": avatarColor } as CSSProperties');
    expect(css).toMatch(
      /\.plan-card-stack-pro \.plan-card-tray \{[\s\S]*?color-mix\(in srgb, var\(--plan-tray-color, var\(--mint\)\) 55%, #fff\)/,
    );
  });

  it("slides the tray out from under the card on hover and tucks it back on leave", () => {
    expect(css).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.plan-card-tray \{\s*transform: translateY\(-100%\);\s*transition: transform 0\.45s/,
    );
    expect(css).toMatch(
      /\.plan-card-stack:is\(:hover, :focus-within\) \.plan-card-tray \{\s*transform: translateY\(0\);/,
    );
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.plan-card-tray \{\s*transition: none;/);
  });

  it("keeps the tray small, regular weight, narrower than the card, and flat", () => {
    const tray = css.slice(
      css.indexOf(".plan-card-tray {"),
      css.indexOf(".plan-card-stack-pro .plan-card-tray"),
    );
    expect(tray).toContain("font-size: 0.78rem");
    expect(tray).toContain("font-weight: 400");
    expect(tray).toContain("margin: -24px 1.25rem 0");
    expect(tray).not.toContain("box-shadow");
    expect(tray).not.toContain("border-bottom");
    expect(client).toContain('<IconShield className="h-3.5 w-3.5 shrink-0" />');
  });

  it("animates curved aurora waves along the card by default", () => {
    expect(client).toContain("function PlanAurora()");
    expect(client.match(/<PlanAurora \/>/g)).toHaveLength(1);
    expect(client).toContain('className="plan-aurora" aria-hidden');
    for (const n of [1, 2, 3]) {
      expect(client).toContain(`plan-aurora-wave plan-aurora-wave-${n}`);
    }
    for (const wave of ["a", "b", "c"]) {
      expect(css).toMatch(
        new RegExp(`\\.plan-aurora \\{[\\s\\S]*?--plan-wave-${wave}: url\\("data:image/svg\\+xml`),
      );
    }
    expect(css).toMatch(/\.plan-aurora-wave \{[\s\S]*?mask-repeat: repeat-x/);
    expect(css).toMatch(
      /\.plan-aurora-wave-1 \{[\s\S]*?mask-image: var\(--plan-wave-a\);[\s\S]*?plan-wave-half 11s linear infinite/,
    );
    expect(css).toMatch(
      /\.plan-aurora-wave-2 \{[\s\S]*?mask-image: var\(--plan-wave-b\);[\s\S]*?plan-wave-two-thirds 19s linear infinite,/,
    );
    expect(css).toMatch(
      /\.plan-aurora-wave-3 \{[\s\S]*?mask-image: var\(--plan-wave-c\);[\s\S]*?plan-wave-third 8s linear infinite/,
    );
    expect(css).not.toContain("linear infinite reverse");
    expect(css).not.toContain("plan-wave-quarter");
    expect(css).toContain("@keyframes plan-wave-bob");
    expect(css).toContain(".plan-card-pro > :not(.plan-aurora)");
  });

  it("intensifies the aurora on hover instead of following the pointer", () => {
    expect(client).not.toContain("onPointerMove");
    expect(client).not.toContain("--plan-px");
    expect(css).not.toContain("--plan-px");
    expect(css).toMatch(
      /\.plan-card-pro:hover \.plan-aurora \{[\s\S]*?opacity: var\(--plan-glow-hover-opacity\);[\s\S]*?brightness\(1\.06\)/,
    );
    expect(css).toMatch(/\.plan-card-pro:hover \.plan-aurora-wave \{\s*scale: 1 1\.06/);
    expect(css).toMatch(/\.plan-card-pro \{[\s\S]*?--plan-glow-hover-opacity: 0\.95/);
  });

  it("gives the card a little more height", () => {
    expect(css).toMatch(/\.plan-card-free \{[\s\S]*?padding: 1\.75rem 1\.5rem 3\.5rem/);
  });

  it("renders the viewer and plan on the server so the dashboard never flashes Free", () => {
    expect(page).toContain("entitlementForUser(");
    expect(page).toContain("<AccountProvider");
    expect(page).toContain("initialEntitlement={initialEntitlement}");
    expect(page).toContain("viewer={viewer}");
    expect(client).toContain("useAccount()");
    expect(client.match(/fetch\("\/api\/me\/entitlement"/g)).toHaveLength(1);
  });

  it("shows skeletons instead of Free copy while the plan is unknown", () => {
    const planCard = client.slice(
      client.indexOf("export function AccountPlanCard"),
      client.indexOf("export function AccountExtensionCard"),
    );
    expect(planCard).toContain("if (!ent) return <AccountPlanCardSkeleton />");
    expect(client).toContain("function AccountPlanCardSkeleton");
    expect(client).toContain('aria-busy="true"');
    expect(client).not.toContain('"…"');
    expect(css).toMatch(/\.skeleton \{[\s\S]*?color: transparent !important/);
    expect(css).toMatch(/\.skeleton \{[\s\S]*?border-radius: 0 !important/);
    expect(css).toContain("@keyframes skeleton-shimmer");
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.skeleton \{\s*animation: none/);
  });

  it("uses a glass rim for both plans", () => {
    expect(css).toContain(".plan-card-pro::before");
    expect(css).toContain(".plan-card-free::before");
    expect(css).toContain("mask-composite: exclude");
    const planRules = css.slice(
      css.indexOf("/* Branded plan access panel"),
      css.indexOf(".plan-card-pro::before"),
    );
    expect(planRules).not.toContain("box-shadow");
    expect(css).toMatch(/\.plan-card-free \.btn-primary \{[\s\S]*?background: var\(--mint\)/);
    expect(css).toMatch(/\.plan-card-free \.skeleton \{[\s\S]*?rgba\(255, 255, 255, 0\.16\)/);
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.plan-aurora-wave,[\s\S]*?animation: none/);
    expect(reduced).toMatch(/\.plan-card-pro:hover \.plan-aurora-wave[\s\S]*?scale: none/);
  });
});
