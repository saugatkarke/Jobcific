# Extension Connection Feedback Design

## Goal

Give users explicit confirmation after the Seek extension finishes the Jobcific
PKCE connection and receives Pro entitlement.

## Current behavior

The account dashboard sends the user to `/extension/prepare`. The Seek
extension's content bridge detects `data-jt-connect-ready` and asks its service
worker to complete the identity handoff. When the user already has a Jobcific
session, Chrome can complete `launchWebAuthFlow` too quickly to show a visible
window. The service worker exchanges the authorization code, fetches a Pro
entitlement, and silently closes the prepare tab. This makes a successful
connection appear broken.

## Design

The prepare page will immediately show a live **Connecting your extension…**
status. It will not depend on Chrome displaying an identity window, because a
signed-in user can complete that window too quickly to see.

The extension bridge will expose its progress through a
`data-jt-connect-status` attribute on the document root. If the handoff reports
an error, the page will replace the progress state with a clear failure state.
If no redirect or error arrives within five seconds, the page will explain that
the connection is taking longer than expected and offer a **Retry connection**
button that reloads the prepare page.

After the identity handoff, token exchange, and forced entitlement refresh all
succeed, the Seek extension service worker will navigate the existing prepare
tab to:

`/account?extension=connected`

It will no longer close that tab on success.

The account route will recognize `extension=connected` and render a success
banner near the dashboard heading:

> Extension connected: Pro features are ready.

The banner is informational and does not determine entitlement. The existing
entitlement API remains the source of truth for whether Pro features are
unlocked.

## Failure behavior

The service worker must only redirect after the token exchange and entitlement
refresh succeed. If either fails, it leaves the prepare page open and returns
the existing error response so the bridge can retry. The account page must not
show the success banner for missing or unrecognized query values.

## Components

- Seek `background/service-worker.js`: replace successful prepare-tab removal
  with navigation to the connected account URL.
- Seek `content/extensionBridge.js`: publish connecting and error states on the
  prepare page document.
- Website `src/components/ExtensionConnectStatus.tsx`: render connecting,
  delayed, retry, and error feedback.
- Website `src/app/extension/prepare/page.tsx`: include the connection-status
  component next to the signed-in handoff instructions.
- Website `src/app/account/page.tsx`: read the optional `extension` search
  parameter and render the success banner only for `connected`.

## Testing

- Extend the Seek sign-in flow test to require a successful account redirect
  and reject silent prepare-tab removal.
- Extend the Seek bridge test to require connecting and error status signals.
- Extend the prepare-page test to require the progress, timeout, retry, and
  error UI.
- Extend the website account-page test to require parsing the `extension`
  parameter and rendering the connection-success copy.
- Run the focused extension tests, website tests, and website lint/type/build
  checks appropriate to the changed files.

## Scope

This change covers the unpacked Seek extension and the shared Jobcific account
page. It does not alter Paddle billing, PKCE, token storage, entitlement
resolution, or Pro feature gates.
