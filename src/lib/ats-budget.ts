/**
 * Timing budget shared by the ATS route and the Gemini client. Kept in its own
 * module so route tests can assert the real numbers while mocking @/lib/ats.
 */

/** Per-attempt upstream timeout. */
export const ATS_ATTEMPT_TIMEOUT_MS = 22_000;

/** Total upstream attempts, including the first try. */
export const ATS_MAX_ATTEMPTS = 2;

/** Backoff slept once between attempts after a transient failure. */
export const ATS_RETRY_BACKOFF_MS = 750;

/**
 * Route budget. Sits above atsBoundedTotalMs() so the handler always outlives
 * the retry loop and can return its own normalized error code, and below the
 * platform ceiling so a deploy cannot be rejected.
 */
export const ATS_ROUTE_MAX_DURATION_SECONDS = 55;

/** Hard platform ceiling the route budget must never exceed. */
export const ATS_PLATFORM_BUDGET_SECONDS = 60;

/** Worst-case wall time the bounded retry loop can consume. */
export function atsBoundedTotalMs(): number {
  return (
    ATS_MAX_ATTEMPTS * ATS_ATTEMPT_TIMEOUT_MS +
    (ATS_MAX_ATTEMPTS - 1) * ATS_RETRY_BACKOFF_MS
  );
}
