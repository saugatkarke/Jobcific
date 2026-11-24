import { Resend } from "resend";
import { render } from "react-email";
import {
  AuthEmail,
  authEmailSubject,
  type AuthEmailKind,
} from "../../emails/auth-email";
import {
  PLAN_CHANGE_SUBJECT,
  PlanChangeEmail,
  type PlanChangeEmailProps,
} from "../../emails/plan-change-email";
import { APP_NAME } from "./copy";

export type { AuthEmailKind };

export function assertMailDelivered(result: {
  data?: unknown;
  error?: unknown;
}): void {
  if (result.error) {
    throw new Error("Could not send email");
  }
}

export async function sendPlanChangeEmail(
  options: { to: string } & PlanChangeEmailProps,
): Promise<void> {
  const { to, ...props } = options;
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM || `${APP_NAME} <noreply@localhost>`;
  const react = PlanChangeEmail(props);
  const text = await render(react, { plainText: true });
  if (!key) {
    console.info("[mail:dev]", to, PLAN_CHANGE_SUBJECT, text);
    return;
  }
  const result = await new Resend(key).emails.send({
    from,
    to,
    subject: PLAN_CHANGE_SUBJECT,
    react,
    text,
  });
  assertMailDelivered(result);
}

export async function sendAuthEmail(options: {
  to: string;
  kind: AuthEmailKind;
  url: string;
  name?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM || `${APP_NAME} <noreply@localhost>`;
  const subject = authEmailSubject(options.kind);
  const react = AuthEmail({
    kind: options.kind,
    url: options.url,
    name: options.name,
  });
  const text = await render(react, { plainText: true });
  if (!key) {
    console.info("[mail:dev]", options.to, subject, text);
    return;
  }
  const resend = new Resend(key);
  const result = await resend.emails.send({
    from,
    to: options.to,
    subject,
    react,
    text,
  });
  assertMailDelivered(result);
}
