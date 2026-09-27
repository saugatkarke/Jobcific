const EMAIL_PATTERN =
  /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const LINKEDIN_PATTERN =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s<>()|,;]*/gi;
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>()|,;]+|\b(?:github|gitlab|behance|dribbble|medium)\.com\/[^\s<>()|,;]+/gi;
const PHONE_PATTERN =
  /(?<![\w+])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d(?:[\s.-]?\d){5,14}(?!\w)/g;
const YEAR_RANGE = /^(?:19|20)\d{2}\s*[-.]\s*(?:19|20)\d{2}$/;
const NUMERIC_DATE = /^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}$/;

function isPhoneLike(match: string): boolean {
  const value = match.trim();
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  if (YEAR_RANGE.test(value) || NUMERIC_DATE.test(value)) return false;
  return true;
}

function replacePhones(text: string, replacement: string): string {
  return text.replace(PHONE_PATTERN, (match) =>
    isPhoneLike(match) ? replacement : match,
  );
}

/**
 * Swap contact details for presence markers so the model can tell what the
 * resume includes without ever seeing the values.
 */
export function maskResumeContacts(text: string): string {
  const masked = String(text ?? "")
    .replace(EMAIL_PATTERN, "[email provided]")
    .replace(LINKEDIN_PATTERN, "[LinkedIn provided]")
    .replace(URL_PATTERN, "[link provided]");
  return replacePhones(masked, "[phone provided]");
}

export function scrubFeedbackText(text: string): string {
  const cleaned = replacePhones(
    String(text ?? "").replace(EMAIL_PATTERN, ""),
    "",
  );
  return cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
