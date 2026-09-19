import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ExtensionConnectStatus } from "@/components/ExtensionConnectStatus";
import { MarketingShell } from "@/components/MarketingShell";
import { GridBand } from "@/components/PageGrid";
import { getOptionalSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ExtensionPreparePage() {
  const session = await getOptionalSession(await headers());
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent("/extension/prepare")}`);
  }

  const email = session.user.email || "your Jobcific account";

  return (
    <MarketingShell>
      <GridBand as="main" className="border-b border-[var(--line)]">
        <div
          className="col-span-12 px-5 py-16 md:col-span-8 md:col-start-3 md:px-6"
          data-jt-connect-ready="1"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Extension
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Connect your Jobcific extension
          </h1>
          <p className="mt-4 max-w-xl text-[var(--muted)]">
            Signed in as {email}. Chrome will securely link this extension to
            your Jobcific account. The identity step may finish without showing
            a separate window.
          </p>
          <ExtensionConnectStatus />
        </div>
      </GridBand>
    </MarketingShell>
  );
}
