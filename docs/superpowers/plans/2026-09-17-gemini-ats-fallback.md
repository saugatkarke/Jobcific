# Gemini ATS Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated Gemini ATS scoring for Pro users while keeping Chrome's built-in language model as the preferred scorer.

**Architecture:** Jobcific exposes a bearer-authenticated Next.js App Router endpoint that atomically enforces a 1,000-score subscription-period allowance and calls Gemini 3.1 Flash-Lite with a strict JSON schema. The extension uses its existing cache, tries built-in AI first, and calls Jobcific only for unavailable or session-level built-in failures.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM/PostgreSQL, Vitest, Manifest V3 JavaScript, Node test runner, Gemini Developer REST API.

## Global Constraints

- Never expose or log `GEMINI_API_KEY`.
- Never persist or log resume or job-description text.
- Clip resume input to 40,000 characters and job input to 20,000 characters.
- Include 1,000 cloud scores per Paddle subscription period.
- Built-in scores and local cache hits do not consume cloud allowance.
- Do not cloud-fallback after malformed built-in model output.
- Preserve unrelated uncommitted work in both repositories.

---

### Task 1: Backend ATS contracts and Gemini client

**Files:**
- Create: `src/lib/ats.ts`
- Create: `src/lib/ats.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `validateAtsInput(value)`, `buildGeminiRequest(input)`,
  `parseGeminiResponse(value)`, `requestGeminiAts(input, fetchImpl?)`
- Returns: normalized score, summary, tips, dimensions, model, and token usage.

- [ ] **Step 1: Write failing tests**

Cover empty input, clipping, all six bounded dimensions, Gemini request model
and schema, API key header use, successful usage metadata, invalid model JSON,
and one retry for `429`/`5xx`.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run src/lib/ats.test.ts
```

Expected: FAIL because `src/lib/ats.ts` does not exist.

- [ ] **Step 3: Implement the ATS module**

Use `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
the `x-goog-api-key` header, `AbortSignal.timeout`, the approved rubric, and
`responseMimeType: "application/json"`. Parse and validate every required
field before returning.

- [ ] **Step 4: Document server configuration**

Add `GEMINI_API_KEY=` and `ATS_CLOUD_PERIOD_LIMIT=1000` to `.env.example`
without changing `.env.local`.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npx vitest run src/lib/ats.test.ts
```

Expected: PASS.

---

### Task 2: Atomic subscription-period quota

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/schema.test.ts`
- Create: `src/lib/ats-quota.ts`
- Create: `src/lib/ats-quota.test.ts`
- Create: generated files under `drizzle/`

**Interfaces:**
- Produces: `reserveAtsCloudUsage({ userId, periodEnd, limit, db? })`
- Returns: `{ allowed: boolean; used: number; limit: number; remaining: number; periodEnd: string }`.

- [ ] **Step 1: Write failing schema and quota tests**

Require an `ats_cloud_usage` table with a stable period key, user foreign key,
period end, count, and timestamps. Test allowance math and the no-row-returned
case used when an atomic conflict update reaches the limit.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npx vitest run src/lib/schema.test.ts src/lib/ats-quota.test.ts
```

Expected: FAIL because the table and quota module do not exist.

- [ ] **Step 3: Implement atomic reservation**

Insert a row with count `1`; on conflict, update count to `count + 1` only when
the existing count is less than the limit, and use `returning()` to distinguish
success from exhaustion.

- [ ] **Step 4: Generate the migration**

Run:

```bash
npx drizzle-kit generate
```

Expected: a migration adding `ats_cloud_usage`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/lib/schema.test.ts src/lib/ats-quota.test.ts
```

Expected: PASS.

---

### Task 3: Authenticated ATS API route

**Files:**
- Create: `src/app/api/extension/ats-score/route.ts`
- Create: `src/app/api/extension/ats-score/route.test.ts`
- Modify: `src/lib/session-entitlement.ts`
- Modify: `src/lib/session-entitlement.test.ts`

**Interfaces:**
- Consumes: extension bearer JWT, latest subscription row, quota reservation,
  and `requestGeminiAts`.
- Produces: `POST /api/extension/ats-score`.

- [ ] **Step 1: Extract authenticated extension identity**

Add a tested helper that returns verified extension claims from a request
without accepting browser session fallback for this endpoint.

- [ ] **Step 2: Write failing route contract tests**

Test `AUTH_REQUIRED`, `PRO_REQUIRED`, `INVALID_INPUT`,
`SUBSCRIPTION_LIMIT`, successful scoring, allowance metadata,
`MODEL_BUSY`, `MODEL_RESPONSE_INVALID`, and `SERVER_MISCONFIGURED`.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
npx vitest run src/app/api/extension/ats-score/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 4: Implement the route**

Validate before quota reservation, verify current Pro entitlement, reserve one
period unit immediately before Gemini submission, call Gemini, and return only
normalized ATS and non-sensitive allowance/usage data.

- [ ] **Step 5: Run focused backend tests**

Run:

```bash
npx vitest run src/lib/session-entitlement.test.ts src/app/api/extension/ats-score/route.test.ts
```

Expected: PASS.

---

### Task 4: Extension local-first cloud fallback

**Files:**
- Modify: `shared/atsScore.js`
- Modify: `background/service-worker.js`
- Modify: `scripts/atsScore.test.js`
- Create or modify: `scripts/atsFallback.test.js`

**Interfaces:**
- Produces: `scoreAtsWithJobcificCloud(resumeText, jobText, accessToken, jobId)`
  and `isBuiltInFallbackError(error)`.
- Consumes: `validAccessToken(account)` and `JT.APP_ORIGIN`.

- [ ] **Step 1: Replace provider-selection tests with fallback tests**

Require local scoring when available, authenticated Jobcific scoring when
unavailable, fallback for session-level DOM errors, no fallback for JSON parse
or model-content errors, and propagation of allowance metadata.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
node --test scripts/atsScore.test.js scripts/atsFallback.test.js
```

Expected: FAIL because the Jobcific scorer and fallback flow do not exist.

- [ ] **Step 3: Implement the Jobcific cloud scorer**

POST JSON to `${JT.APP_ORIGIN}/api/extension/ats-score` with the extension
bearer token. Normalize successful output with the existing parser and preserve
stable server error codes and messages.

- [ ] **Step 4: Implement service-worker orchestration**

Keep cache and entitlement checks first. Try built-in AI only when available;
otherwise acquire a valid access token and call Jobcific. Fall back only for the
approved availability/session error set.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test scripts/atsScore.test.js scripts/atsFallback.test.js
```

Expected: PASS.

---

### Task 5: Remove provider and API-key controls

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.js`
- Modify: `popup/popup.css`
- Modify: `shared/constants.js`
- Modify: `shared/resumeStorage.js`
- Modify: `scripts/popupAccountChip.test.js`
- Modify: `README.md`
- Modify: `docs/store-listing.md`

**Interfaces:**
- Produces: resume UI copy describing automatic on-device/cloud behavior.
- Removes: provider selection and user API-key storage paths from active UI.

- [ ] **Step 1: Write failing source/UI tests**

Require the automatic scoring copy and reject API-key inputs, provider radios,
and instructions asking users to supply keys.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
node --test scripts/popupAccountChip.test.js scripts/atsScore.test.js
```

Expected: FAIL while the old controls remain.

- [ ] **Step 3: Remove obsolete UI and runtime paths**

Keep resume upload/remove and native availability status. Replace provider
controls with clear local-first/cloud-fallback copy and remove unused key event
handlers and constants.

- [ ] **Step 4: Update public documentation**

Disclose secure Jobcific/Google cloud processing when on-device AI is
unavailable and remove personal-key language.

- [ ] **Step 5: Run focused extension tests**

Run:

```bash
node --test scripts/popupAccountChip.test.js scripts/atsScore.test.js scripts/atsFallback.test.js
```

Expected: PASS.

---

### Task 6: Cross-project verification

**Files:**
- Verification only.

**Interfaces:**
- Produces: release evidence for backend and extension.

- [ ] **Step 1: Run all Jobcific tests**

Run:

```bash
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Type-check and build Jobcific**

Run:

```bash
npx tsc --noEmit
npm run build
```

Expected: both exit with code 0.

- [ ] **Step 3: Run all extension tests**

Run:

```bash
node --test scripts/*.test.js
```

Expected: all Node tests PASS.

- [ ] **Step 4: Inspect changed-file diagnostics**

Read IDE diagnostics for every modified source file and resolve introduced
errors.

- [ ] **Step 5: Record deployment prerequisites**

Report the generated database migration, required Vercel environment variables,
privacy-copy change, and manual Chrome/Google end-to-end test steps.
