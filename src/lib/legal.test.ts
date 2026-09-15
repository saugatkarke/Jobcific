import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ATS_CLOUD_STATEMENT,
  ATS_NO_PERSONAL_API_KEY_STATEMENT,
  ATS_ON_DEVICE_STATEMENT,
  ATS_TEXT_PROCESSORS,
  GEMINI_PROVIDER_NAME,
  LEGAL_LAST_UPDATED,
  LEGAL_PAGES,
  PADDLE_MOR_STATEMENT,
  REFUND_FIRST_PAYMENT_DAYS,
  RESUME_LOCAL_COPY_STATEMENT,
  SUPPORT_EMAIL,
  canStartSubscribe,
  sellerIdentity,
} from "./legal";

describe("Paddle seller identity", () => {
  it("names the sole trader, ABN, and Jobcific brand", () => {
    expect(sellerIdentity()).toBe(
      "Saugat Karki (ABN 59 615 422 149), trading as Jobcific",
    );
  });

  it("lists buyer support email", () => {
    expect(SUPPORT_EMAIL).toBe("riosaugat@gmail.com");
  });
});

describe("Paddle policy pages", () => {
  it("exposes separate privacy, terms, and refund URLs", () => {
    expect(LEGAL_PAGES).toEqual([
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/refunds", label: "Refund Policy" },
    ]);
  });

  it("includes Paddle's required Merchant of Record sentence", () => {
    expect(PADDLE_MOR_STATEMENT).toBe(
      "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.",
    );
  });

  it("offers a 30-day refund on the first payment", () => {
    expect(REFUND_FIRST_PAYMENT_DAYS).toBe(30);
  });
});

describe("checkout legal acceptance", () => {
  it("blocks subscribe until the buyer agrees", () => {
    expect(canStartSubscribe(false)).toBe(false);
    expect(canStartSubscribe(true)).toBe(true);
  });
});

describe("ATS privacy disclosures", () => {
  it("names both parties that can receive resume and job text", () => {
    expect(ATS_TEXT_PROCESSORS).toEqual(["Jobcific", "Google (Gemini API)"]);
    expect(GEMINI_PROVIDER_NAME).toBe("Google (Gemini API)");
  });

  it("reads as a sentence fragment when joined for rendering", () => {
    expect(ATS_TEXT_PROCESSORS.join(" and ")).toBe(
      "Jobcific and Google (Gemini API)",
    );
  });

  it("says a resume copy is kept locally for reuse", () => {
    expect(RESUME_LOCAL_COPY_STATEMENT).toMatch(/keeps a copy/i);
    expect(RESUME_LOCAL_COPY_STATEMENT).toMatch(
      /browser['’]s extension storage/i,
    );
    expect(RESUME_LOCAL_COPY_STATEMENT).toMatch(/reused/i);
  });

  it("says on-device scoring keeps text on the device", () => {
    expect(ATS_ON_DEVICE_STATEMENT).toMatch(/on-device/i);
    expect(ATS_ON_DEVICE_STATEMENT).toMatch(/leaves your device/i);
  });

  it("says cloud scoring sends resume and job text to Jobcific and Gemini", () => {
    expect(ATS_CLOUD_STATEMENT).toMatch(/unavailable/i);
    expect(ATS_CLOUD_STATEMENT).toMatch(/resume text/i);
    expect(ATS_CLOUD_STATEMENT).toMatch(/job description text/i);
    expect(ATS_CLOUD_STATEMENT).toMatch(/Jobcific/);
    expect(ATS_CLOUD_STATEMENT).toMatch(/Google Gemini API/);
  });

  it("denies any personal AI provider API key", () => {
    expect(ATS_NO_PERSONAL_API_KEY_STATEMENT).toMatch(/no longer/i);
    expect(ATS_NO_PERSONAL_API_KEY_STATEMENT).toMatch(/API key/i);
    expect(ATS_NO_PERSONAL_API_KEY_STATEMENT).toMatch(/do not hold one/i);
  });
});

describe("privacy policy page", () => {
  const page = readFileSync("src/app/privacy/page.tsx", "utf8");

  it("renders the ATS scoring section from the shared disclosures", () => {
    expect(page).toContain("ATS resume scoring");
    expect(page).toContain("{RESUME_LOCAL_COPY_STATEMENT}");
    expect(page).toContain("{ATS_ON_DEVICE_STATEMENT}");
    expect(page).toContain("{ATS_CLOUD_STATEMENT}");
    expect(page).toContain("{ATS_NO_PERSONAL_API_KEY_STATEMENT}");
  });

  it("drops the stale claim that resumes and ATS API keys never leave the browser", () => {
    expect(page).not.toContain("ATS API");
    expect(page).not.toMatch(
      /Job descriptions, tracked jobs, Kanban boards, resumes/,
    );
  });

  it("lists resume and job text under information we collect", () => {
    expect(page).toContain("ATS scoring content");
    expect(page).toContain("ATS usage counts");
  });

  it("describes total ATS reservations rather than cloud-only usage", () => {
    expect(page).toMatch(
      /ATS usage counts: the number of ATS scores reserved in your current\s+billing period/i,
    );
    expect(page).not.toMatch(/number of cloud ATS scores you have used/i);
  });

  it("describes the extension's cloud ATS behaviour", () => {
    const section = page.slice(
      page.indexOf("Chrome extension</h2>"),
      page.indexOf("Cookies</h2>"),
    );
    expect(section).toMatch(/cloud ATS scoring/i);
    expect(section).toMatch(/does not send\s*\n?\s*your tracked jobs/i);
  });

  it("names Gemini as a service provider under sharing", () => {
    const section = page.slice(
      page.indexOf("Sharing and service providers</h2>"),
      page.indexOf("International transfers</h2>"),
    );
    expect(section).toContain("{GEMINI_PROVIDER_NAME}");
    expect(section).toMatch(/resume text and job\s*\n?\s*description text/i);
  });

  it("renders ATS_TEXT_PROCESSORS in the sharing copy so the constant cannot drift", () => {
    const section = page.slice(
      page.indexOf("Sharing and service providers</h2>"),
      page.indexOf("International transfers</h2>"),
    );
    expect(section).toContain('{ATS_TEXT_PROCESSORS.join(" and ")}');
    // The bound must stay honest about transit-only handling.
    expect(section).toMatch(/hosting provider that\s*\n?\s*carries the request/i);
    expect(section).toMatch(/Paddle and Resend never receive it/);
  });

  it("imports every legal constant it renders", () => {
    const imports = page.slice(0, page.indexOf('} from "@/lib/legal"'));
    [
      "ATS_CLOUD_STATEMENT",
      "ATS_NO_PERSONAL_API_KEY_STATEMENT",
      "ATS_ON_DEVICE_STATEMENT",
      "ATS_TEXT_PROCESSORS",
      "GEMINI_PROVIDER_NAME",
      "RESUME_LOCAL_COPY_STATEMENT",
    ].forEach((name) => {
      expect(imports).toContain(name);
    });
  });

  it("covers offshore processing of ATS text under international transfers", () => {
    const section = page.slice(
      page.indexOf("International transfers</h2>"),
      page.indexOf("Retention</h2>"),
    );
    expect(section).toMatch(/AI providers/i);
    expect(section).toMatch(/cloud ATS scoring/i);
    expect(section).toMatch(/United States/);
  });

  it("keeps every section heading uniquely numbered in order", () => {
    const numbers = [...page.matchAll(/<h2>(\d+)\./g)].map((m) =>
      Number(m[1]),
    );
    expect(numbers.length).toBeGreaterThan(10);
    expect(numbers).toEqual(numbers.map((_value, index) => index + 1));
  });
});

describe("legal last-updated stamp", () => {
  it("is the date of the latest policy change", () => {
    expect(LEGAL_LAST_UPDATED).toBe("18 September 2026");
  });

  it("is a real, parseable date", () => {
    const parsed = new Date(`${LEGAL_LAST_UPDATED} UTC`);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(8);
    expect(parsed.getUTCDate()).toBe(18);
  });

  it("is rendered once at the top of every legal page", () => {
    const legalPage = readFileSync("src/components/LegalPage.tsx", "utf8");
    expect(legalPage).toContain("Last updated: {LEGAL_LAST_UPDATED}");
    expect(legalPage).toContain("LEGAL_LAST_UPDATED");
  });

  it("is not hardcoded in any policy page", () => {
    ["privacy", "terms", "refunds"].forEach((slug) => {
      const source = readFileSync(`src/app/${slug}/page.tsx`, "utf8");
      expect(source).not.toContain("September 2026");
      expect(source).not.toContain("Last updated:");
    });
  });
});

describe("marketing FAQ", () => {
  const faq = readFileSync("src/components/FaqAccordion.tsx", "utf8");

  it("no longer claims ATS API keys stay in the browser", () => {
    expect(faq).not.toContain("ATS API keys");
  });

  it("discloses the cloud ATS fallback path", () => {
    expect(faq).toMatch(/Google Gemini API/);
    expect(faq).toMatch(/on-device/i);
  });
});
