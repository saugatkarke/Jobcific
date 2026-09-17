# Gemini ATS Fallback Design

## Goal

Provide every paid Jobcific user with ATS scoring without requiring a personal
AI API key. Prefer Chrome's built-in language model when it is available and
use Jobcific's server-side Gemini account only when on-device AI cannot run.

## Architecture

The extension continues to gate ATS results with the Jobcific entitlement.
After checking its existing local result cache, it checks Chrome's built-in
language-model availability. Available devices score locally. Unavailable,
download/session failures fall back to an authenticated Jobcific endpoint.
Malformed local model output does not trigger cloud fallback because that would
unexpectedly transmit resume text after local processing began.

`POST /api/extension/ats-score` accepts the extension bearer token, resume text,
job-description text, and optional job ID. The Next.js server verifies the JWT
and current Pro subscription, atomically reserves one request from the current
subscription period, calls `gemini-3.1-flash-lite`, validates the structured
response, and returns the ATS result plus non-sensitive usage metadata.

The Gemini API key is read only from the server-side `GEMINI_API_KEY`
environment variable. It is never returned, logged, embedded in the extension,
or exposed through a `NEXT_PUBLIC_*` variable.

## Cloud Allowance

Each Pro subscription period includes 1,000 cloud-generated ATS scores.
On-device scores and local cache hits do not count. Manual rescoring and new job
scores count when they reach Gemini. Usage resets at the subscription period
boundary.

Usage reservation is atomic so concurrent requests cannot exceed the allowance.
One user action consumes at most one allowance unit even when the server retries
a transient Gemini `429` or `5xx` response.

## Gemini Request

The server clips resume text to 40,000 characters and job text to 20,000
characters. It sends the existing ATS rubric and JSON schema to
`gemini-3.1-flash-lite` with temperature `0.2`, JSON response MIME type, and a
bounded output size. The design keeps the model explicit and cost-sensitive by
using the stable Flash-Lite tier and relying only on the request contract we
control, not model-default thinking assumptions.

The response must include:

- overall integer score from 0 through 100;
- non-empty summary;
- one through five actionable tips;
- integer scores for keywords, experience, skills, formatting,
  qualifications, and role fit.

Invalid or incomplete Gemini output is rejected rather than cached.

## Authentication and Privacy

The endpoint accepts only a valid extension access JWT and resolves entitlement
from the database; it never trusts a client-supplied plan. Request bodies are
validated before quota reservation. Resume and job-description text are not
persisted or written to application logs.

Operational records may include user ID, timestamp, model, token counts,
outcome, and a one-way job-text hash. The product privacy copy must state that
resume and job-description text may be sent to Google when on-device AI is
unavailable.

## Error Handling

The API returns stable error codes:

- `AUTH_REQUIRED` for missing or invalid extension tokens;
- `PRO_REQUIRED` when ATS is not currently entitled;
- `DAILY_LIMIT` is not used; subscription exhaustion returns
  `SUBSCRIPTION_LIMIT`;
- `INVALID_INPUT` for missing or oversized request fields;
- `MODEL_BUSY` after bounded retries of transient Gemini failures;
- `MODEL_RESPONSE_INVALID` for invalid structured output;
- `SERVER_MISCONFIGURED` when server-only configuration is missing.

The extension preserves these codes and presents concise user-facing messages.
It does not fall back from malformed built-in output to cloud processing.

## Extension Experience

The Upload Resume screen no longer exposes model selection or API-key fields.
It explains that ATS scoring uses on-device AI when available and secure
Jobcific cloud processing otherwise. Previously stored provider choices and API
keys become unused; they may be removed from local extension storage during the
migration.

Cloud results include allowance metadata so the extension can report remaining
scores when relevant. Existing job/resume cache semantics remain unchanged.

## Verification

Backend tests cover input validation, Gemini payload and response parsing,
authentication, Pro entitlement, atomic allowance exhaustion, subscription
period reset, transient retry behavior, and stable errors.

Extension tests cover local-first selection, unavailable/session fallback,
non-fallback for malformed local responses, bearer-authenticated cloud
requests, cache behavior, quota messaging, and removal of provider/API-key UI.

Before release, compare at least 50 representative resume/job pairs between the
built-in model and Gemini, checking schema validity, score stability, tip
quality, latency, and measured token cost. Configure Google billing alerts and
a server-wide spend circuit breaker separately from per-user allowance.
