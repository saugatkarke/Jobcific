import { describe, expect, it } from "vitest";
import {
  changeButtonLabel,
  changeErrorText,
  changeSummaryText,
  type ChangePreview,
} from "./plan-change-copy";

function preview(overrides: Partial<ChangePreview>): ChangePreview {
  return {
    kind: "upgrade",
    effectiveAt: "2026-12-21T00:00:00.000Z",
    chargeToday: 0,
    nextAmount: 11.99,
    nextBilledAt: null,
    dropsLegacy: false,
    ...overrides,
  };
}

const labels = { currentLabel: "Bifocal (Indeed, Seek)", nextLabel: "Lens (Seek)" };

describe("changeSummaryText", () => {
  it("explains a downgrade and when it takes effect", () => {
    expect(
      changeSummaryText({
        ...labels,
        interval: "monthly",
        preview: preview({ kind: "downgrade", nextAmount: 4.99 }),
      }),
    ).toBe(
      "Downgrade to Lens (Seek) on Dec 21. You keep Bifocal (Indeed, Seek) until then, then $4.99 a month.",
    );
  });

  it("states today's charge for an upgrade", () => {
    expect(
      changeSummaryText({
        currentLabel: "Lens (Seek)",
        nextLabel: "Panorama (Indeed, LinkedIn, Seek)",
        interval: "monthly",
        preview: preview({ chargeToday: 3.4 }),
      }),
    ).toBe(
      "Upgrade to Panorama (Indeed, LinkedIn, Seek) now. You'll be charged $3.40 today, then $11.99 a month.",
    );
  });

  it("describes interval credits and the legacy price", () => {
    expect(
      changeSummaryText({
        ...labels,
        interval: "monthly",
        preview: preview({ kind: "interval", chargeToday: -6.5, nextAmount: 4.99, dropsLegacy: true }),
      }),
    ).toBe(
      "Switch to Lens (Seek), billed monthly, now. Your unused time leaves a $6.50 credit for future bills, then $4.99 a month. Your legacy $4.99 price ends with this change.",
    );
  });
});

describe("labels", () => {
  it("names the action on the button", () => {
    expect(changeButtonLabel(preview({ kind: "downgrade" }))).toBe("Downgrade on Dec 21");
    expect(changeButtonLabel(preview({ kind: "upgrade" }))).toBe("Upgrade now");
    expect(changeButtonLabel(preview({ kind: "interval" }))).toBe("Switch now");
  });

  it("falls back for unknown errors", () => {
    expect(changeErrorText("SWAP_NOT_SUPPORTED")).toMatch(/coming soon/);
    expect(changeErrorText("WHATEVER")).toBe("Something went wrong. Try again.");
  });
});
