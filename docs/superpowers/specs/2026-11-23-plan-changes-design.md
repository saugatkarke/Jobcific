# Plan changes: upgrades, downgrades, and interval switches

Project 3 of 5. Builds on per-extension entitlement (project 1) and plans and checkout (project 2). Swaps (same plan, different extensions) are project 4 and are out of scope here.

## Goal

A Pro subscriber can change their plan from the account page:

- Upgrade to more extensions.
- Downgrade to fewer extensions.
- Switch between Monthly and Quarterly.
- Undo a scheduled downgrade before it takes effect.

They see exactly what will happen, when, and what they pay before they confirm.

## Change rules

| Change | Takes effect | Billing (Paddle `proration_billing_mode`) |
|---|---|---|
| Upgrade: more extensions, same interval | Now | `prorated_immediately`, `on_payment_failure: prevent_change` |
| Downgrade: fewer extensions, same interval | End of the current billing period | `full_next_billing_period` (nothing charged now, new price at renewal) |
| Interval switch, with or without an extension change | Now | `prorated_immediately` (Paddle credits unused time) |

Interval switches are always immediate because Paddle only allows `prorated_immediately`, `full_immediately`, or `do_not_bill` when the billing cycle changes, and the billing period restarts at the moment of change.

Extension rules, checked on the server:

- Upgrade: the new set contains every current extension, plus more.
- Downgrade: the new set is a non-empty subset of the current extensions.
- Interval switch: the new set follows the same rule for its count (superset when the count grows, subset when it shrinks, identical when it stays the same).
- Panorama always means all three extensions.
- Same count with different extensions is a swap and is rejected (`SWAP_NOT_SUPPORTED`).
- The new price must be a current checkout price (not legacy), and the new extension count must match its plan.

Blocked states (no change allowed, clear message shown):

- A downgrade is already scheduled (`CHANGE_PENDING`). The user undoes it first.
- The subscription is set to cancel at period end (`CANCEL_SCHEDULED`). The user resumes it in the billing portal first.
- Status is `past_due` or not active (`NOT_ACTIVE`).
- Paddle rejects the update, for example within 30 minutes of renewal (`PADDLE_REJECTED`, with "Try again in an hour").
- The new price and extensions equal the current ones (`NO_CHANGE`).

Legacy subscribers ($4.99 Bifocal): any change drops the legacy price. The confirm step says "Your legacy $4.99 price ends with this change." Undoing a scheduled downgrade restores the legacy price ID, so the legacy prices must stay active (not archived) in Paddle.

## Data model

Three nullable columns on `subscription`, describing the plan the user keeps until a scheduled downgrade takes effect:

- `carry_price_id text`
- `carry_extensions text[]`
- `carry_until timestamptz`

When a downgrade is scheduled, the route copies the current `paddle_price_id` and `extensions` into the carry columns and sets `carry_until` to `current_period_end`. Paddle then holds the new price.

Effective plan rule (one pure function, `effectivePlan(row, now)`):

- If `carry_until` is set and `now < carry_until`, the effective price and extensions are the carry values.
- Otherwise they are `paddle_price_id` and `extensions`.

Every consumer that reads the plan uses the effective plan: `entitledExtensions`, the ATS limit (`monthsInInterval`), `currentPlan`, `entitlementForUser`, and the account page. No job runs at period end. Once `carry_until` passes, the new plan applies on the next read.

The Paddle webhook keeps writing `paddle_price_id` and `extensions` as today and never writes the carry columns. One exception: a `subscription.canceled` event clears the carry columns.

## API

All routes require a session, load the latest subscription row, and return `{ error }` codes from the lists above.

`POST /api/billing/change-plan/preview`, body `{ priceId, extensions }`:

- Validates as below and classifies the change (`upgrade`, `downgrade`, `interval`).
- For immediate changes, calls Paddle `subscriptions.previewUpdate` and returns `chargeToday` (from `immediateTransaction` totals, can be 0 or a credit).
- Returns `{ kind, effectiveAt, chargeToday, nextAmount, nextBilledAt, dropsLegacy }`.

`POST /api/billing/change-plan`, same body:

- Revalidates, then calls Paddle `subscriptions.update` with the new item, the billing mode from the table, and `customData: { userId, extensions }`.
- Downgrade: writes the carry columns and sends the scheduled-change email.
- Upgrade or interval: writes `paddle_price_id` and `extensions` right away from the Paddle response, so the UI reflects the change before the webhook arrives.
- Returns the same shape as the preview.

`DELETE /api/billing/change-plan`:

- Only valid when a downgrade is scheduled (`NO_PENDING_CHANGE` otherwise).
- Calls Paddle `subscriptions.update` back to `carry_price_id` with `full_next_billing_period` and `customData.extensions = carry_extensions`.
- Restores `paddle_price_id` and `extensions` from the carry values and clears the carry columns.

The change logic lives in `src/lib/plan-change.ts` as pure functions (`classifyChange`, `validateChange`, `effectivePlan`), so the routes stay thin and the rules are unit tested.

## Account page

A "Change plan" panel under the plan card, only for active Pro subscribers:

- Extension pills (same plus to tick pills as the pricing card) and a Monthly / Quarterly toggle, starting at the current plan.
- The plan name and price update as the user picks, like the pricing card.
- A summary line from the preview, for example:
  - "Downgrade to Lens on Dec 21. You keep Seek, Indeed, and LinkedIn until then, then $4.99 a month."
  - "Upgrade to Panorama now. You'll be charged $3.40 today, then $11.99 a month."
  - "Switch to Quarterly now. You'll be charged $6.12 today after credit for this month, then $17.99 a quarter."
- The confirm button names the action ("Downgrade on Dec 21", "Upgrade now", "Switch now"). It is disabled when nothing changed or the picks are a swap, with a hint ("Swapping extensions is coming soon").
- When a downgrade is scheduled, the panel shows a notice instead: "Your plan changes to Lens (Seek) on Dec 21. Until then you keep Bifocal (Seek, Indeed)." with a "Keep my current plan" button.
- Blocked states show their message in place of the confirm button.

The plan card tray and `planSummary` show the effective plan. On the pricing page, the subscriber note "Plan changes are coming soon." becomes a link: "Change your plan from your account."

## Email

`emails/plan-change-email.tsx`, sent through a new `sendPlanChangeEmail` in `src/lib/mail.ts` (same Resend setup and dev logging as auth emails). Sent only when a downgrade is scheduled.

- Subject: "Your Jobcific plan change is scheduled"
- Body: current plan and extensions, new plan and extensions, the date it takes effect, the new price, and a link to the account page to undo it.

A send failure is logged and does not fail the change.

## Analytics

No new GTM events. Upgrades and interval switches are not new purchases, so `purchaseToQueue` stays as it is (it only queues first purchases).

## Testing

- `plan-change.test.ts`: classification, extension rules, swaps, Panorama, legacy, blocked states, and `effectivePlan` before and after `carry_until`.
- Route tests for preview, change, and undo with Paddle mocked: billing mode per kind, carry columns written and cleared, error codes, email sent only for downgrades.
- Entitlement and ATS reservation tests: a scheduled downgrade keeps the old extensions and limit until `carry_until`.
- Webhook test: carry columns survive `subscription.updated` and clear on `subscription.canceled`.

## Out of scope

- Swaps, free or paid (project 4).
- Marketing copy (project 5).
- Scheduling interval switches for period end.
