import { describe, expect, it } from "vitest";
import { maskResumeContacts, scrubFeedbackText } from "./resume-privacy";

describe("maskResumeContacts", () => {
  it("masks emails, phones, LinkedIn and other links", () => {
    const masked = maskResumeContacts(
      [
        "jane.doe+jobs@example.com.au",
        "+61 412 345 678 | 0412-345-678 | (02) 9876 5432 | +1 (555) 123-4567",
        "linkedin.com/in/jane-doe https://www.linkedin.com/in/jane",
        "https://janedoe.dev github.com/janedoe",
      ].join("\n"),
    );
    expect(masked).not.toMatch(/jane|example|412|9876|555/i);
    expect(masked).toContain("[email provided]");
    expect(masked.match(/\[phone provided\]/g)).toHaveLength(4);
    expect(masked.match(/\[LinkedIn provided\]/g)).toHaveLength(2);
    expect(masked.match(/\[link provided\]/g)).toHaveLength(2);
  });

  it("leaves dates, years, postcodes and short numbers alone", () => {
    const text =
      "2019-2023 | 01.02.2020 | Sydney NSW 2000 | 5 years | 120 staff";
    expect(maskResumeContacts(text)).toBe(text);
  });

  it("returns text without contacts unchanged", () => {
    expect(maskResumeContacts("React developer")).toBe("React developer");
  });

  it("handles long unbroken text in linear time", () => {
    const text = `${"R".repeat(100_000)}${"1".repeat(100_000)}`;
    const startedAt = performance.now();
    maskResumeContacts(text);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});

describe("scrubFeedbackText", () => {
  it("removes leaked emails and phone numbers", () => {
    expect(
      scrubFeedbackText("Reach you at jane@example.com or 0412 345 678 now."),
    ).toBe("Reach you at or now.");
  });

  it("keeps normal feedback untouched", () => {
    expect(scrubFeedbackText("Your resume shows 5 years of React.")).toBe(
      "Your resume shows 5 years of React.",
    );
  });
});
