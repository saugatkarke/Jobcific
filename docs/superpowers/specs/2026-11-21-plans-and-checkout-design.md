# Plans and checkout design (Lens, Bifocal, Panorama)

**Date:** 2026-11-21
**Status:** Approved design
**Project:** 2 of 5 in the multi-plan billing work. Builds on `2026-11-21-per-extension-entitlement-design.md`.

## Plans

| Plan | Extensions | Monthly | Quarterly |
|---|---|---|---|
| Lens | 1, chosen at checkout | $4.99 | $9.99 |
| Bifocal | 2, chosen at checkout | $8.99 | $17.99 |
| Panorama | All 3 | $11.99 | $23.99 |

- Quarterly bills every 3 months, about 33% off three monthly payments.
- Yearly is retired for new buyers. No subscriber is on it.
- Legacy: the existing `PADDLE_PRICE_ID_MONTHLY` ($4.99) and `PADDLE_PRICE_ID_YEARLY` ($39) prices map to Bifocal with Seek and Indeed. Legacy subscribers keep that price until they change plan (project 3).
- ATS cloud limit: 1,000 scores per month on every plan, so 3,000 per quarterly period (12,000 on legacy yearly).

## Decisions

- Lens and Bifocal buyers pick extensions on the pricing page, before checkout. Subscribe stays disabled until the right number is ticked.
- Pricing page shows four cards: Free, Lens, Bifocal, Panorama ("Best value").
- Existing subscribers see "Current plan" on their plan card. Other paid cards show "Plan changes coming soon" and are disabled until project 3.
- The selection is stored in a new nullable `extensions text[]` column on `subscription`. The plan comes from the Paddle price ID, never stored twice.

## Paddle setup

Three products (Lens, Bifocal, Panorama), each with a monthly price (every 1 month) and a quarterly price (every 3 months). New env vars:

```
PADDLE_PRICE_ID_LENS_MONTHLY
PADDLE_PRICE_ID_LENS_QUARTERLY
PADDLE_PRICE_ID_BIFOCAL_MONTHLY
PADDLE_PRICE_ID_BIFOCAL_QUARTERLY
PADDLE_PRICE_ID_PANORAMA_MONTHLY
PADDLE_PRICE_ID_PANORAMA_QUARTERLY
```

`PADDLE_PRICE_ID_MONTHLY` and `PADDLE_PRICE_ID_YEARLY` stay as the legacy prices. Archive the yearly price in Paddle, do not delete it.

## Components

### `src/lib/pricing.ts`

- `PLANS`: id, name, extension count, monthly and quarterly amounts.
- `priceInfo(priceId)`: `{ priceId, plan, interval, amount, legacy }` or `null`. The single source for mapping Paddle prices.
- `isProPriceId`, `intervalFromPriceId`: now backed by `priceInfo`.
- `isCheckoutPriceId`: true only for the six new prices.
- `monthsInInterval`: 1, 3, or 12.
- `planCardCta`: per-card button state (Subscribe, Subscribing..., Current plan, Plan changes coming soon, Pick N).
- `BillingInterval` becomes `"monthly" | "quarterly" | "yearly"` (yearly is legacy only).

### Checkout (`/api/billing/checkout`)

Body `{ priceId, extensions }`.

1. `401` without a session.
2. `400 INVALID_PRICE` unless `isCheckoutPriceId(priceId)`.
3. `400 INVALID_EXTENSIONS` unless the list has exactly the plan's count of distinct known extensions. Panorama ignores the list and stores all three.
4. `409 ALREADY_SUBSCRIBED` when the user already has an active Pro subscription.
5. Creates the Paddle transaction with `customData: { userId, extensions }`. The transaction is created server-side, so the buyer cannot alter it, and Paddle copies custom data onto the subscription.

### Webhook

`mapPaddleSubscription` accepts any `priceInfo` price, reads `customData.extensions`, drops unknown names, and stores the list. A Lens or Bifocal subscription whose list has the wrong count is still saved, with a warning logged. Entitlement only ever grants valid stored picks.

### Entitlement

`entitledExtensions(resolved, row)`:

- Not Pro: `[]`.
- Legacy price: Seek and Indeed.
- Panorama: all three.
- Lens or Bifocal: stored picks, filtered to known extensions, capped at the plan count.

`entitlementForUser` adds `planId` (`"lens" | "bifocal" | "panorama" | null`) and `legacy` (boolean) to the payload, next to `extensions`.

### ATS limit

`ats-reservation` uses `atsPeriodLimit() * monthsInInterval(interval)` for the subscription's price.

### Pricing page

- Toggle: Monthly / Quarterly with a "-33%" badge.
- Lens and Bifocal cards: extension checkboxes (Seek, Indeed, LinkedIn). Ticking beyond the count is blocked. Hint shows "Pick 1" or "Pick 2" until satisfied.
- Panorama: lists all three, highlighted "Best value".
- One shared Terms and Refund Policy checkbox.

### Account page

Status line shows the plan name and its extensions, for example "active monthly, Bifocal: Seek, Indeed".

### Analytics

`user.purchase_event_interval` now stores the purchased price ID. `claimPurchaseEvent` returns `{ interval, plan, value }` from `priceInfo`. Older queued values (`"monthly"`, `"yearly"`) still map to legacy amounts. GTM `begin_checkout` and `purchase` events gain a `plan` field.

### Copy

Terms page lists the new plan prices. Wider marketing copy is project 5.

## Migration

`ALTER TABLE subscription ADD COLUMN extensions text[]`. Generated with `drizzle-kit generate`, applied with `drizzle-kit push`. Existing rows stay `NULL`.

## Testing

- `pricing`: price table, legacy mapping, quarterly discount, card CTA states.
- Checkout route: invalid price, wrong extension count, duplicate extensions, already subscribed, Panorama stores all three, custom data contents.
- `paddle-map`: stores extensions, drops unknown names.
- `entitlement`: each plan, legacy, capped picks.
- `ats-reservation`: quarterly limit is 3x.
- `purchase-event`: price ID queued and claimed.
