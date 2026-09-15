export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refunds", label: "Refund Policy" },
] as const;

export const SELLER_LEGAL_NAME = "Saugat Karki";
export const SELLER_ABN = "59 615 422 149";
export const SUPPORT_EMAIL = "riosaugat@gmail.com";
export const LEGAL_LAST_UPDATED = "18 September 2026";
export const SITE_URL = "https://www.jobcific.com";
export const PADDLE_BUYER_PORTAL = "https://paddle.net";
export const PADDLE_HELP_EMAIL = "help@paddle.com";
export const REFUND_FIRST_PAYMENT_DAYS = 30;

export const PADDLE_MOR_STATEMENT =
  "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.";

/** Third parties that can receive resume or job text during cloud ATS scoring. */
export const ATS_TEXT_PROCESSORS = [
  "Jobcific",
  "Google (Gemini API)",
] as const;

export const RESUME_LOCAL_COPY_STATEMENT =
  "When you upload a resume, the extension keeps a copy of its extracted text in your browser's extension storage so it can be reused for later ATS scores without uploading the file again. You can remove it at any time from the extension popup.";

export const ATS_ON_DEVICE_STATEMENT =
  "When Chrome's built-in on-device AI is available, ATS scoring runs entirely in your browser and neither your resume text nor the job description leaves your device.";

export const ATS_CLOUD_STATEMENT =
  "When built-in on-device AI is unavailable, the extension sends your resume text and the job description text to Jobcific, and Jobcific sends that text to the Google Gemini API to generate the score. We use that text only to produce your score and do not use it to train models.";

export const ATS_NO_PERSONAL_API_KEY_STATEMENT =
  "ATS scoring no longer uses a personal AI provider API key. You do not enter or store one, and we do not hold one for you.";

export const GEMINI_PROVIDER_NAME = "Google (Gemini API)";

export function sellerIdentity(): string {
  return `${SELLER_LEGAL_NAME} (ABN ${SELLER_ABN}), trading as Jobcific`;
}

export function canStartSubscribe(agreedToLegal: boolean): boolean {
  return agreedToLegal;
}
