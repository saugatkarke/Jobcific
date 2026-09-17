# Extension Connection Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redirect a successfully connected Seek extension to the Jobcific account page and show explicit confirmation that Pro features are ready.

**Architecture:** The Seek service worker remains responsible for deciding when the PKCE handoff, token exchange, and entitlement refresh have all succeeded. It will navigate the prepare tab to `/account?extension=connected`; the website will treat that query parameter as informational UI state and render a success banner without changing entitlement.

**Tech Stack:** Chrome Manifest V3 JavaScript, Next.js 15 App Router, React 19, Vitest, Node test runner.

## Global Constraints

- Redirect only after token exchange and forced entitlement refresh succeed.
- Do not change Paddle billing, PKCE, token storage, entitlement resolution, or Pro feature gates.
- Do not show success for missing or unrecognized query values.
- Keep failures on the prepare page so the bridge can retry.

---

### Task 1: Account connection-success banner

**Files:**
- Modify: `src/app/account/page.test.ts`
- Modify: `src/app/account/page.tsx`

**Interfaces:**
- Consumes: `searchParams: Promise<{ checkout?: string; extension?: string }>`
- Produces: account-page banner rendered only when `extension === "connected"`

- [ ] **Step 1: Write the failing test**

Add this test to `src/app/account/page.test.ts`:

```ts
it("shows extension success only for the connected query state", () => {
  expect(page).toContain('extension?: string');
  expect(page).toContain('extension === "connected"');
  expect(page).toContain("Extension connected: Pro features are ready.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/account/page.test.ts
```

Expected: FAIL because the account page does not parse `extension` or contain the success message.

- [ ] **Step 3: Implement the minimal banner**

Update the page search parameters and destructuring:

```ts
searchParams: Promise<{ checkout?: string; extension?: string }>;
```

```ts
const { checkout, extension } = await searchParams;
```

Render this immediately after `<AccountWelcome />`:

```tsx
{extension === "connected" ? (
  <p
    role="status"
    className="mt-4 rounded-[4px] border border-[var(--mint)] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
  >
    Extension connected: Pro features are ready.
  </p>
) : null}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx vitest run src/app/account/page.test.ts
```

Expected: PASS.

---

### Task 2: Prepare-page progress and recovery UI

**Files:**
- Modify: `src/app/extension/prepare/page.test.ts`
- Modify: `src/app/extension/prepare/page.tsx`
- Create: `src/components/ExtensionConnectStatus.tsx`

**Interfaces:**
- Consumes: optional `data-jt-connect-status="error"` on `document.documentElement`
- Produces: immediate connecting status, five-second delayed state, reload retry action, and extension error feedback

- [ ] **Step 1: Write a failing source contract test**

Read `src/components/ExtensionConnectStatus.tsx` from the existing prepare-page
test and require the component to contain the connecting, delayed, retry, and
error copy plus the five-second timer and reload action.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/extension/prepare/page.test.ts
```

Expected: FAIL because the status component does not exist.

- [ ] **Step 3: Implement the status component**

Create a client component that starts in `connecting`, observes
`data-jt-connect-status`, changes to `waiting` after 5000 milliseconds, and
reloads the current page when **Retry connection** is clicked. Render it from
the signed-in prepare page.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx vitest run src/app/extension/prepare/page.test.ts
```

Expected: PASS.

---

### Task 3: Seek bridge status signaling and successful-handoff redirect

**Files:**
- Modify: `/Users/saugatkarki/Desktop/Chrome Extensions/Job Track AU:NZ - for Seek/scripts/signInWelcome.test.js`
- Modify: `/Users/saugatkarki/Desktop/Chrome Extensions/Job Track AU:NZ - for Seek/scripts/extensionBridge.test.js`
- Modify: `/Users/saugatkarki/Desktop/Chrome Extensions/Job Track AU:NZ - for Seek/content/extensionBridge.js`
- Modify: `/Users/saugatkarki/Desktop/Chrome Extensions/Job Track AU:NZ - for Seek/background/service-worker.js`

**Interfaces:**
- Consumes: `beginIdentityHandoff(prepareTabId)` after `startSignIn()` resolves
- Produces: `chrome.tabs.update(prepareTabId, { url: JT.appUrl("/account?extension=connected") })`

- [ ] **Step 1: Replace the close-tab assertion with a redirect assertion**

In `scripts/signInWelcome.test.js`, replace the successful-close test with:

```js
test("successful identity handoff redirects the prepare tab to account success", () => {
  assert.match(
    sw,
    /function beginIdentityHandoff[\s\S]{0,800}tabs\.update\([\s\S]{0,160}\/account\?extension=connected/,
  );
  assert.doesNotMatch(
    sw,
    /function beginIdentityHandoff[\s\S]{0,800}tabs\.remove/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from the Seek extension directory:

```bash
node --test scripts/signInWelcome.test.js
```

Expected: FAIL because `beginIdentityHandoff` still calls `chrome.tabs.remove`.

- [ ] **Step 3: Implement the successful redirect**

Replace the successful tab-removal block in `beginIdentityHandoff` with:

```js
if (typeof prepareTabId === "number") {
  await chrome.tabs.update(prepareTabId, {
    url: JT.appUrl("/account?extension=connected"),
  });
}
```

Keep this block inside `.then(...)`, so failures do not redirect.

- [ ] **Step 4: Run focused extension tests**

Run:

```bash
node --test scripts/signInWelcome.test.js scripts/extensionBridge.test.js
```

Expected: all tests PASS.

---

### Task 4: Cross-project verification

**Files:**
- Verify only; no production changes expected.

**Interfaces:**
- Consumes: website success banner and extension success redirect
- Produces: verified end-to-end connection feedback

- [ ] **Step 1: Run the website tests**

Run:

```bash
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Run website diagnostics**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Reload and verify manually**

Reload the unpacked Seek extension from `chrome://extensions`, open the account
dashboard, and click **Connect extension**.

Expected sequence:

1. `/extension/prepare` opens.
2. The extension completes token exchange and entitlement refresh.
3. The same tab navigates to `/account?extension=connected`.
4. The account page displays **Extension connected: Pro features are ready.**
5. The extension popup reports Pro and Hide/ATS remain available.
