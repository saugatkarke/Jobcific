import Link from "next/link";
import { LegalPage, legalMetadata } from "@/components/LegalPage";
import { APP_NAME, DISCLAIMER } from "@/lib/copy";
import {
  PADDLE_BUYER_PORTAL,
  PADDLE_HELP_EMAIL,
  PADDLE_MOR_STATEMENT,
  SUPPORT_EMAIL,
  sellerIdentity,
} from "@/lib/legal";
import { MONTHLY_LABEL, YEARLY_LABEL } from "@/lib/pricing";

export const metadata = legalMetadata(
  "Terms of Service",
  `Terms for using ${APP_NAME} and purchasing Pro through Paddle.`,
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) are a contract between you and{" "}
        {sellerIdentity()} (“we”, “us”) for use of {APP_NAME}, including the
        website, accounts, and Chrome extension. {DISCLAIMER} By creating an
        account or buying Pro you agree to these Terms and to the{" "}
        <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/refunds">Refund Policy</Link>.
      </p>

      <h2>1. The service</h2>
      <p>
        {APP_NAME} helps you track Indeed and Seek listings in the browser.
        Free features include listing metrics, copy job description, save, a
        local Kanban board, CSV export, and local resume storage. Pro unlocks
        Hide / Unhide job cards and ATS score results. Job data and resumes stay
        in your browser unless you export them yourself.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide an accurate email address and keep your password
        confidential. You are responsible for activity on your account. We may
        suspend or close an account that is abusive, fraudulent, or in breach
        of these Terms.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <p>{PADDLE_MOR_STATEMENT}</p>
      <p>
        Pro is a subscription. Current advertised prices are {MONTHLY_LABEL}{" "}
        and {YEARLY_LABEL}. The price, currency, tax, and renewal date shown at
        Paddle checkout are the amounts you agree to pay. Subscriptions renew
        automatically until you cancel. Cancel from{" "}
        <Link href="/account">Manage billing</Link> on your account, or through
        Paddle. If you cancel at period end you keep Pro until the paid period
        ends.
      </p>
      <p>
        Paddle collects payment, tax, and issues invoices. Questions about a
        charge, invoice, or payment method can be raised with Paddle at{" "}
        <a href={PADDLE_BUYER_PORTAL} rel="noopener noreferrer">
          paddle.net
        </a>{" "}
        or{" "}
        <a href={`mailto:${PADDLE_HELP_EMAIL}`}>{PADDLE_HELP_EMAIL}</a>. Product
        questions can be sent to us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>4. Fair use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape, overload, or reverse engineer the service except as allowed by law.</li>
        <li>Share a Pro account in a way that lets many people use one paid seat.</li>
        <li>Use {APP_NAME} to break Indeed, Seek, or other third-party terms.</li>
        <li>Attempt to access another person’s account or data.</li>
        <li>Use the service for anything illegal or harmful.</li>
      </ul>

      <h2>5. Third-party sites</h2>
      <p>
        {APP_NAME} works on Indeed and Seek pages. Those sites are not our
        products. Their layout, availability, and terms can change. We are not
        responsible for Indeed, Seek, or any employer’s hiring process.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        We own {APP_NAME} and its branding. You keep ownership of your account
        information and of job data and resumes stored in your browser. You grant
        us a limited licence to process account and billing data as needed to
        provide the service.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim to keep the website, billing, and extension working, but we do
        not guarantee uninterrupted access. Browser updates, Indeed or Seek
        changes, or hosting issues can affect features.
      </p>

      <h2>8. Disclaimer</h2>
      <p>
        The service is provided “as is”. ATS scores and listing metrics are
        tools to help you apply. They are not a promise of an interview or a job.
        To the fullest extent allowed by law, we disclaim implied warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2>9. Liability</h2>
      <p>
        Nothing in these Terms limits liability that cannot be limited under
        Australian Consumer Law or other mandatory law, including for fraud or
        personal injury. Where we are allowed to limit liability, our total
        liability for a claim is limited to the amount you paid us for Pro in
        the 12 months before the claim, or AUD $100 if you have not paid.
      </p>

      <h2>10. Complaints</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We aim to
        acknowledge complaints within 2 business days and to give an outcome
        within 10 business days. If we cannot resolve it, Australian consumers may
        contact their state or territory fair trading office or the ACCC.
        Payment complaints can also go to Paddle.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may change these Terms, prices, or features. Material changes will
        appear on this page with a new “Last updated” date. If you do not
        agree, stop using the service and cancel Pro. Continued use after the
        update means you accept the new Terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of Australia. Courts in Australia
        may hear disputes, without limiting any non-excludable consumer rights
        you have in the country where you live.
      </p>

      <h2>13. Contact</h2>
      <p>
        {sellerIdentity()}
        <br />
        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
