import Link from "next/link";
import { LegalPage, legalMetadata } from "@/components/LegalPage";
import { APP_NAME } from "@/lib/copy";
import {
  PADDLE_BUYER_PORTAL,
  PADDLE_HELP_EMAIL,
  PADDLE_MOR_STATEMENT,
  REFUND_FIRST_PAYMENT_DAYS,
  SUPPORT_EMAIL,
  sellerIdentity,
} from "@/lib/legal";

export const metadata = legalMetadata(
  "Refund Policy",
  `How ${APP_NAME} Pro refunds work, including the 30-day first-payment guarantee.`,
);

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        This Refund Policy explains how refunds work for {APP_NAME} Pro. It
        forms part of our <Link href="/terms">Terms of Service</Link>.{" "}
        {PADDLE_MOR_STATEMENT}
      </p>

      <h2>1. First payment: 30-day money-back</h2>
      <p>
        If you are not satisfied with Pro, we will refund your first Pro payment
        in full if you ask within {REFUND_FIRST_PAYMENT_DAYS} days of that
        payment. This applies to the first monthly payment and the first yearly
        payment. You do not need to give a reason.
      </p>

      <h2>2. Renewals</h2>
      <p>
        Later renewal payments are reviewed case by case. Email us if a
        renewal charged after you thought you had cancelled, if Pro was
        unavailable, or if there was a billing error. We will look at the order
        with Paddle. We may refund, offer a partial refund, or decline, except
        where the law requires a refund.
      </p>

      <h2>3. How to request a refund</h2>
      <p>You can:</p>
      <ul>
        <li>
          Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          from the address on your account, with your order email and
          approximate payment date. We will arrange the refund with Paddle.
        </li>
        <li>
          Go to{" "}
          <a href={PADDLE_BUYER_PORTAL} rel="noopener noreferrer">
            paddle.net
          </a>
          , use Request refund, or use the “View receipt” or “Manage
          subscription” link in the email Paddle sent you. You can also email
          Paddle at{" "}
          <a href={`mailto:${PADDLE_HELP_EMAIL}`}>{PADDLE_HELP_EMAIL}</a>.
        </li>
      </ul>
      <p>
        Do not send a refund to yourself. Paddle processes approved refunds as
        merchant of record.
      </p>

      <h2>4. How refunds are paid</h2>
      <p>
        Approved refunds go back to the original payment method where possible,
        usually within 14 days of approval. Your bank may take longer to show
        the credit. When a first-payment refund is approved, we remove Pro
        access.
      </p>

      <h2>5. Cancellation is not a refund</h2>
      <p>
        You can cancel auto-renewal at any time from{" "}
        <Link href="/account">Manage billing</Link>. Cancelling stops the next
        charge. It does not automatically refund the current period. If you want
        money back, follow section 3 as well as cancelling.
      </p>

      <h2>6. Statutory rights</h2>
      <p>
        Nothing in this policy limits rights you have under Australian Consumer
        Law or other mandatory consumer law where you live. If you are a
        consumer in the EU or UK you may have a 14-day withdrawal right for
        distance contracts. Pro is supplied digitally and starts as soon as you
        subscribe. Our {REFUND_FIRST_PAYMENT_DAYS}-day first-payment refund is
        offered in addition to any non-excludable statutory right.
      </p>

      <h2>7. Chargebacks</h2>
      <p>
        If you do not recognise a charge, contact us or Paddle first. A
        chargeback with your bank is slower and can delay a genuine refund.
        Paddle’s buyer terms and refund policy also apply to transactions it
        processes.
      </p>

      <h2>8. Contact</h2>
      <p>
        {sellerIdentity()}
        <br />
        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
