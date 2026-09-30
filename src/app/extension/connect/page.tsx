import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MarketingShell } from "@/components/MarketingShell";
import { GridBand } from "@/components/PageGrid";
import { getAuth } from "@/lib/auth";
import { isAllowedRedirectUri } from "@/lib/crypto-hash";
import { markExtensionEventPending } from "@/lib/extension-event";
import { insertAuthCode } from "@/lib/extension-auth";

export const dynamic = "force-dynamic";

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}) {
  const q = await searchParams;
  const redirectUri = String(q.redirect_uri || "");
  const state = String(q.state || "");
  const codeChallenge = String(q.code_challenge || "");
  const method = String(q.code_challenge_method || "");

  if (method !== "S256" || !isAllowedRedirectUri(redirectUri) || !state || !codeChallenge) {
    return (
      <MarketingShell>
        <GridBand as="main" className="border-b border-[var(--line)]">
          <div className="col-span-12 px-5 py-16 md:col-span-8 md:col-start-3 md:px-6">
            <h1 className="hero-enter hero-enter-2 text-2xl font-bold tracking-tight">Invalid extension sign-in</h1>
            <p className="hero-enter hero-enter-3 mt-3 text-sm text-[var(--muted)]">
              The redirect URI or PKCE challenge is not allowed.
            </p>
          </div>
        </GridBand>
      </MarketingShell>
    );
  }

  const next = `/extension/connect?${new URLSearchParams({
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: method,
  }).toString()}`;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const code = await insertAuthCode({
    userId: session.user.id,
    codeChallenge,
    redirectUri,
    state,
  });
  try {
    await markExtensionEventPending(session.user.id);
  } catch (error) {
    console.error("Could not record extension connect for analytics", error);
  }
  redirect(`${redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
}
