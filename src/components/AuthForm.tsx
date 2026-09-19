"use client";

import Link from "next/link";
import { FormEvent, useRef, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { authPageHref, betterAuthAcceptsCallbackURL } from "@/lib/auth-origins";
import { BusyButton, holdBusy, paintPending } from "@/components/BusyButton";
import {
  IconAlertCircle,
  IconKey,
  IconMail,
  IconUser,
  IconUserPlus,
} from "@/components/icons";

function AuthLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-black"
    >
      {icon}
      {children}
    </Link>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-[var(--muted)]">{hint}</span>
      ) : null}
      {children}
    </label>
  );
}

function AuthFeedback({
  tone,
  icon,
  title,
  message,
}: {
  tone: "error" | "success";
  icon: ReactNode;
  title?: string;
  message: string;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-black";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`auth-feedback flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3 ${styles}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        {title ? <p className="text-sm font-bold leading-snug">{title}</p> : null}
        <p className={`leading-snug ${title ? "mt-0.5 text-sm font-semibold" : "text-sm font-bold"}`}>
          {message}
        </p>
      </div>
    </div>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <AuthFeedback
      tone="error"
      icon={<IconAlertCircle className="h-[18px] w-[18px] text-red-600" />}
      message={message}
    />
  );
}

function AuthNotice({ message }: { message: string }) {
  return (
    <AuthFeedback
      tone="success"
      icon={<IconMail className="h-[18px] w-[18px] text-emerald-700" />}
      message={message}
    />
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"password" | "magic" | null>(null);
  const submittingRef = useRef(false);
  const busy = pending !== null;

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const form = new FormData(event.currentTarget);
    submittingRef.current = true;
    setError("");
    setNotice("");
    await paintPending(() => setPending("password"));
    const startedAt = Date.now();
    try {
      const { error: result } = await authClient.signIn.email({
        email,
        password: String(form.get("password") || ""),
      });
      if (result) {
        await holdBusy(startedAt);
        submittingRef.current = false;
        setPending(null);
        const status = (result as { status?: number }).status;
        const code = (result as { code?: string }).code;
        if (status === 403 || code === "EMAIL_NOT_VERIFIED") {
          setError("Please verify your email first. We sent you a fresh verification link.");
          return;
        }
        setError(result.message || "Could not sign in.");
        return;
      }
      window.location.assign(nextPath);
    } catch {
      await holdBusy(startedAt);
      submittingRef.current = false;
      setPending(null);
      setError("Could not sign in.");
    }
  }

  async function onMagic() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setNotice("");
    await paintPending(() => setPending("magic"));
    const startedAt = Date.now();
    try {
      const { error: result } = await authClient.signIn.magicLink({
        email,
        callbackURL: betterAuthAcceptsCallbackURL(nextPath)
          ? nextPath
          : "/account",
      });
      await holdBusy(startedAt);
      submittingRef.current = false;
      setPending(null);
      if (result) {
        setError("Could not send email.");
        return;
      }
      setNotice("Check your email for a sign-in link.");
    } catch {
      await holdBusy(startedAt);
      submittingRef.current = false;
      setPending(null);
      setError("Could not send email.");
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={onPassword} aria-busy={pending === "password"}>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            disabled={busy}
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            required
            className="field"
            disabled={busy}
          />
        </Field>
        <BusyButton
          type="submit"
          busy={pending === "password"}
          busyLabel="Signing in..."
          disabled={busy}
        >
          Sign in
        </BusyButton>
      </form>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          or
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <BusyButton
        type="button"
        className="btn-secondary w-full gap-2"
        busy={pending === "magic"}
        busyLabel="Sending link..."
        disabled={busy || !email}
        onClick={onMagic}
      >
        Email me a magic link
      </BusyButton>
      {error ? <AuthError message={error} /> : null}
      {notice ? <AuthNotice message={notice} /> : null}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)]">
        <AuthLink href={authPageHref("/signup", nextPath)} icon={<IconUserPlus className="h-3.5 w-3.5" />}>
          Create an account
        </AuthLink>
        <AuthLink href="/forgot-password" icon={<IconKey className="h-3.5 w-3.5" />}>
          Forgot password
        </AuthLink>
      </p>
    </div>
  );
}

export function SignupForm({ nextPath = "/account" }: { nextPath?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);
  const submittingRef = useRef(false);
  const locked = pending || created;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || created) return;
    const form = new FormData(event.currentTarget);
    submittingRef.current = true;
    setError("");
    await paintPending(() => setPending(true));
    const startedAt = Date.now();
    try {
      const { error: result } = await authClient.signUp.email({
        name: String(form.get("name") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        callbackURL: betterAuthAcceptsCallbackURL(nextPath)
          ? nextPath
          : "/account",
      });
      if (result) {
        submittingRef.current = false;
        setError(result.message || "Could not create account.");
        return;
      }
      setCreated(true);
    } catch {
      submittingRef.current = false;
      setError("Could not create account.");
    } finally {
      await holdBusy(startedAt);
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} aria-busy={pending}>
      <Field label="Name">
        <input name="name" required className="field" disabled={locked} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className="field" disabled={locked} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="field"
          disabled={locked}
        />
      </Field>
      <p className="text-xs text-[var(--muted)]">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="text-black underline-offset-2 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-black underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <BusyButton type="submit" busy={pending} busyLabel="Creating account..." disabled={locked}>
        {created ? "Account created" : "Create account"}
      </BusyButton>
      {error ? <AuthError message={error} /> : null}
      {created ? (
        <AuthFeedback
          tone="success"
          icon={<IconMail className="h-[18px] w-[18px] text-emerald-700" />}
          title="Account created"
          message="Check your inbox and verify your email before signing in."
        />
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)]">
        Already have an account?
        <AuthLink href={authPageHref("/login", nextPath)} icon={<IconUser className="h-3.5 w-3.5" />}>
          Sign in
        </AuthLink>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    await paintPending(() => setPending(true));
    const startedAt = Date.now();
    const { error: result } = await authClient.requestPasswordReset({
      email: String(form.get("email") || ""),
      redirectTo: "/reset-password",
    });
    await holdBusy(startedAt);
    setPending(false);
    if (result) {
      setError("Could not send email.");
      return;
    }
    setNotice("If that email exists, we sent a reset link. Check your inbox.");
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Field label="Email">
        <input name="email" type="email" required className="field" disabled={pending} />
      </Field>
      <BusyButton type="submit" busy={pending} busyLabel="Sending link...">
        Send reset link
      </BusyButton>
      {error ? <AuthError message={error} /> : null}
      {notice ? <AuthNotice message={notice} /> : null}
      <p className="border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)]">
        <AuthLink href="/login" icon={<IconUser className="h-3.5 w-3.5" />}>
          Back to sign in
        </AuthLink>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    await paintPending(() => setPending(true));
    const startedAt = Date.now();
    const { error: result } = await authClient.resetPassword({
      token,
      newPassword: String(form.get("password") || ""),
    });
    if (result) {
      await holdBusy(startedAt);
      setPending(false);
      setError(result.message || "Could not reset password.");
      return;
    }
    window.location.href = "/login";
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} className="field" disabled={pending} />
      </Field>
      <BusyButton type="submit" busy={pending} busyLabel="Saving...">
        Set new password
      </BusyButton>
      {error ? <AuthError message={error} /> : null}
    </form>
  );
}
