# Per-extension entitlement design

**Date:** 2026-11-21
**Status:** Approved design, pending spec review
**Project:** 1 of 5 in the multi-plan billing work (Lens, Bifocal, Panorama)

## Context

Jobcific now has three Chrome extensions: Seek, Indeed, and LinkedIn. Upcoming plans sell Pro per extension:

| Plan | Extensions | Monthly | Quarterly |
|---|---|---|---|
| Lens | 1 of the user's choice | $4.99 | $9.99 |
| Bifocal | 2 of the user's choice | $8.99 | $17.99 |
| Panorama | All 3 | $11.99 | $23.99 |

Existing $4.99 subscribers become legacy Bifocal (Seek and Indeed) and keep their price until they change plan.

Today the server cannot tell which extension is calling. The access JWT carries only `sub` and `email`, so `/api/me/entitlement` returns `plan: "pro"` to any connected extension of a paying user. This project adds that missing piece. Later projects build on it:

1. **Per-extension entitlement (this spec)**
2. New plans, stored selection, checkout
3. Upgrades and downgrades
4. Extension swaps (free at renewal, $1.99 immediate)
5. Marketing copy for LinkedIn and the new plans

## Goals

- The server knows which extension made each authenticated request, without trusting the extension to say so.
- Pro features (entitlement response and cloud ATS routes) are granted only to extensions included in the user's plan.
- No behavior change for current users on Seek and Indeed. No forced reconnects.
- The Seek and Indeed extensions keep working without code changes.

## Non-goals

- New Paddle prices, plan picker, or stored extension selection (project 2).
- Plan changes or swaps (projects 3 and 4).
- LinkedIn marketing copy (project 5).

## Already done

LinkedIn is registered in `src/lib/extensions.ts` (`client: "linkedin"`, dev ID `gefachkggkhiiolgngplghiemhfbbjae`, `cwsUrl: null`) and its redirect URI is in `EXTENSION_REDIRECT_URIS` (`.env.local`, `.env.example`). The Chrome Web Store ID will be added after publishing, ahead of the dev ID, matching the other entries. Production `EXTENSION_REDIRECT_URIS` must also receive the LinkedIn URIs before release.

## Design

### 1. Client claim in the access token

`signAccessJwt` gains a `client` argument and writes it as a `client` claim (`"seek" | "indeed" | "linkedin"`, omitted when null).

- `exchangeAuthorizationCode` already resolves the client from the redirect URI via `extensionClientForRedirectUri`. That value is passed to both the refresh token row (as today) and the access token.
- `rotateRefreshToken` passes `row.client`, so the claim survives every refresh.
- `verifyAccessJwt` returns `{ sub, email, client }`, where `client` is an `ExtensionClient` or `null`. An unknown string is treated as `null`.
- `extensionClaimsFromRequest` passes the new field through unchanged.

The client is derived server-side from the allow-listed redirect URI, so an extension cannot claim to be another one.

### 2. Entitled extensions

New pure function in `src/lib/entitlement.ts`:

```ts
entitledExtensions(resolved: Entitlement): ExtensionClient[]
```

- Not Pro: `[]`.
- Pro: `["seek", "indeed"]`. Every current Pro subscription is legacy Bifocal.

Project 2 replaces the Pro branch with the stored selection (Lens, Bifocal, Panorama). Callers do not change.

New pure function for the per-request decision:

```ts
isClientEntitled(client: ExtensionClient | null, extensions: ExtensionClient[]): boolean
```

- Known client: `extensions.includes(client)`.
- `null` client (legacy token issued before extensions were told apart, which can only be Seek or Indeed): entitled when `extensions` includes both `"seek"` and `"indeed"`. This holds for every legacy user, so no one is forced to reconnect.

### 3. `/api/me/entitlement` response

The existing shape stays. Two fields are added:

```json
{
  "authenticated": true,
  "email": "a@b.com",
  "plan": "free",
  "status": "active",
  "currentPeriodEnd": "2026-12-21T00:00:00.000Z",
  "features": { "hideJobs": false, "atsResults": false },
  "interval": "monthly",
  "extensions": ["seek", "indeed"],
  "reason": "extension_not_included"
}
```

- `extensions`: what the plan covers, always present (`[]` for free users).
- `reason`: present only when the account is Pro but the calling extension is not entitled. The only value in this project is `"extension_not_included"`. Extensions can use it to show "Add LinkedIn to your plan".
- Extension token, client entitled: account-level Pro payload, unchanged.
- Extension token, client not entitled: `plan: "free"`, both features `false`, `reason` set. `status`, `currentPeriodEnd`, and `interval` still reflect the real subscription.
- Website session (no bearer token): account-level payload with `extensions`, no `reason`.

### 4. Server-side Pro routes

- `POST /api/extension/ats-reservation`: after the existing Pro check, also requires `isClientEntitled(claims.client, entitledExtensions(resolved))`. Otherwise returns `403 { error: "PRO_REQUIRED", reason: "extension_not_included" }`. The error code is unchanged so existing extension handling still works.
- `POST /api/extension/ats-score`: the reservation token gains a `client` claim set at reservation time. The score route rejects a reservation whose `client` differs from `claims.client` (`409 RESERVATION_INVALID`). This keeps the score route free of a subscription lookup while stopping a reservation from one extension being spent by another. Reservations with no `client` claim (issued before deploy, valid for minutes) are accepted.

### 5. Data and migrations

None. `extension_refresh_token.client` already exists as nullable text.

## Error handling

- Unknown or malformed `client` claim: treated as `null`, then handled by the legacy rule. It never grants more than Seek and Indeed.
- Missing `BETTER_AUTH_SECRET` or DB errors: unchanged from today.

## Testing

Unit tests (Vitest, alongside existing `*.test.ts`):

- `extension-auth`: access token round-trip carries `client`. Null client omits the claim. An unknown claim value verifies as `null`.
- `entitlement`: `entitledExtensions` for free and Pro. `isClientEntitled` for entitled, not entitled, and legacy `null` cases.
- `session-entitlement`: payload for an entitled client, a non-entitled client (`reason` set, features off), and a website session.
- `ats-reservation` route: LinkedIn token on a legacy plan gets `403` with `reason`. Seek token still succeeds.
- `ats-score` route: a reservation with a mismatched `client` is rejected. A matching one and a claimless one are accepted.

## Rollout

1. Deploy with production `EXTENSION_REDIRECT_URIS` including the LinkedIn URIs.
2. Existing access tokens (no claim) expire within 15 minutes, and refreshes keep the stored client. Legacy refresh tokens with a `null` client keep working through the legacy rule.
3. No action needed from current users.
