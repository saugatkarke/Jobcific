import { SignupForm } from "@/components/AuthForm";
import { AuthLayout } from "@/components/AuthLayout";
import { MarketingShell } from "@/components/MarketingShell";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/account";

  return (
    <MarketingShell>
      <AuthLayout
        eyebrow="Account"
        title="Create account"
        description="Email and password. We will email a verification link before first sign in."
        notes={[
          "Track jobs locally with Metrics, Copy JD, Save, and Kanban.",
          "Connect the Indeed, LinkedIn, or Seek extension after you sign in.",
          "Upgrade to Pro here when you want Hide jobs and ATS scores.",
        ]}
      >
        <SignupForm nextPath={nextPath} />
      </AuthLayout>
    </MarketingShell>
  );
}
