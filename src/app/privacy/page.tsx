import Link from "next/link";
import { LegalPage, legalMetadata } from "@/components/LegalPage";
import { APP_NAME, DISCLAIMER } from "@/lib/copy";
import {
  ATS_CLOUD_STATEMENT,
  ATS_NO_PERSONAL_API_KEY_STATEMENT,
  ATS_ON_DEVICE_STATEMENT,
  ATS_TEXT_PROCESSORS,
  GEMINI_PROVIDER_NAME,
  PADDLE_BUYER_PORTAL,
  RESUME_LOCAL_COPY_STATEMENT,
  SUPPORT_EMAIL,
  sellerIdentity,
} from "@/lib/legal";

export const metadata = legalMetadata(
  "Privacy Policy",
  `How ${APP_NAME} collects, uses, and stores account and billing data.`,
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains how {sellerIdentity()} (“we”, “us”) handles
        personal information when you use {APP_NAME} at{" "}
        <Link href="/">jobcific.com</Link>, create an account, subscribe to Pro,
        or connect the Chrome extension. {DISCLAIMER}
      </p>

      <h2>1. Who we are</h2>
      <p>
        {APP_NAME} is a job-tracking product for Indeed and Seek. The website
        provides accounts, Pro billing, and cloud ATS resume scoring. The Chrome
        extension tracks jobs locally in your browser. For privacy questions,
        email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <p>When you use the website, we may collect:</p>
      <ul>
        <li>
          Account details: name, email address, password hash, and email
          verification status.
        </li>
        <li>
          Session data: login cookies, IP address, and browser user agent used
          to keep you signed in and protect the account.
        </li>
        <li>
          Billing identifiers: Paddle customer ID, subscription ID, price ID,
          plan, status, and current period end. We use these to know whether
          your account is Free or Pro.
        </li>
        <li>
          Extension connection data: short-lived authorization codes and
          tokens so the extension can read your Pro vs Free status. These are
          not used to read your tracked jobs.
        </li>
        <li>
          ATS scoring content: when cloud ATS scoring runs, we receive the
          resume text and job description text for that request, plus the Seek
          or Indeed job identifier. See section 4 for how that works.
        </li>
        <li>
          ATS usage counts: the number of ATS scores reserved in your current
          billing period, so we can apply your plan&rsquo;s included
          allowance.
        </li>
      </ul>

      <h2>3. Information we do not collect</h2>
      <ul>
        <li>We do not store card numbers, CVV, or bank details.</li>
        <li>
          Your tracked jobs, Kanban board, notes, statuses, and uploaded resume
          file stay in the browser extension. We do not receive them on this
          website.
        </li>
        <li>
          We do not ask for or hold an AI provider API key.{" "}
          {ATS_NO_PERSONAL_API_KEY_STATEMENT}
        </li>
        <li>
          We do not run advertising analytics, marketing pixels, or sell
          personal information.
        </li>
      </ul>

      <h2>4. ATS resume scoring</h2>
      <p>{RESUME_LOCAL_COPY_STATEMENT}</p>
      <p>{ATS_ON_DEVICE_STATEMENT}</p>
      <p>{ATS_CLOUD_STATEMENT}</p>
      <p>
        We do not keep the resume text or job description text from a cloud ATS
        request after the score is returned. We retain only the score result in
        your browser and the per-period usage count on our side.{" "}
        {GEMINI_PROVIDER_NAME} processes the text under its own terms as our
        service provider.
      </p>

      <h2>5. How we use information</h2>
      <p>We use personal information to:</p>
      <ul>
        <li>Create and secure your account, including email verification and password reset.</li>
        <li>Send transactional email (verification, magic link, and password reset).</li>
        <li>Process Pro subscriptions through Paddle and keep entitlement in sync.</li>
        <li>Let the connected Chrome extension read whether you have Pro.</li>
        <li>
          Generate a cloud ATS score from the resume and job text you submit,
          and reserve allowance before any new ATS score is generated.
        </li>
        <li>Respond to support requests and meet legal obligations.</li>
      </ul>
      <p>
        We rely on performing our contract with you, our legitimate interests in
        running and securing the service, and (where required) your consent.
      </p>

      <h2>6. Payments and Paddle</h2>
      <p>
        Paid orders are processed by Paddle, the merchant of record. Paddle
        collects payment details, tax information, and billing address as needed
        to complete checkout. Paddle’s privacy policy applies to that processing.
        You can manage receipts and some billing requests at{" "}
        <a href={PADDLE_BUYER_PORTAL} rel="noopener noreferrer">
          paddle.net
        </a>
        .
      </p>

      <h2>7. Email</h2>
      <p>
        We send transactional email through Resend. We do not send marketing
        newsletters unless you later opt in. Magic-link and reset emails contain
        a sign-in or reset URL. Do not forward those emails.
      </p>

      <h2>8. Chrome extension</h2>
      <p>
        The extension stores your tracked jobs, hidden jobs, board state, and
        your uploaded resume text on your device. It contacts this website to
        read whether your plan is Pro or Free and, for cloud ATS scoring only,
        to send the resume and job text described in section 4. It does not send
        your tracked jobs, notes, or statuses to us. Uninstalling the extension
        does not delete your website account, and removing the resume in the
        extension popup deletes the local copy.
      </p>

      <h2>9. Cookies</h2>
      <p>
        We use essential cookies and similar storage to keep you signed in and
        to remember short-lived UI state (for example, a pricing animation). We
        do not use non-essential tracking cookies.
      </p>

      <h2>10. Sharing and service providers</h2>
      <p>We share personal information only with:</p>
      <ul>
        <li>Paddle, for checkout, tax, invoices, and refunds.</li>
        <li>Resend, to deliver account email.</li>
        <li>
          {GEMINI_PROVIDER_NAME}, which receives the resume text and job
          description text for a cloud ATS score so it can return that score. It
          receives nothing else about you: no name, email, account ID, or
          billing data.
        </li>
        <li>
          Hosting and database providers who process data on our instructions to
          run the website.
        </li>
        <li>Professional advisers or authorities if the law requires it.</li>
      </ul>
      <p>
        Resume and job description text is handled only by{" "}
        {ATS_TEXT_PROCESSORS.join(" and ")}, plus the hosting provider that
        carries the request in transit. Paddle and Resend never receive it.
      </p>
      <p>We do not sell personal information.</p>

      <h2>11. International transfers</h2>
      <p>
        {APP_NAME} is operated from Australia. Paddle, email, hosting, database,
        and AI providers may process data in other countries, including the
        United Kingdom, European Economic Area, and United States. In
        particular, resume and job text sent for cloud ATS scoring is processed
        by {GEMINI_PROVIDER_NAME} on infrastructure that may be located outside
        Australia, including the United States. Those providers are engaged to
        provide the service described in this policy, and we rely on their
        contractual terms and standard data-protection safeguards.
      </p>

      <h2>12. Retention</h2>
      <p>
        We keep account and subscription records while your account is open and
        for a reasonable period afterwards so we can handle billing, refunds,
        disputes, and legal requirements. Resume and job text submitted for a
        cloud ATS score is not retained after the score is returned; only the
        per-period usage count is kept. You can ask us to delete your account
        data. We may retain limited records where we must, for example tax or
        dispute records held by Paddle.
      </p>

      <h2>13. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        delete, or receive a copy of your personal information, to object to or
        restrict certain processing, and to complain to a regulator. Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will
        respond within 30 days where we can. Australian users can also contact
        the Office of the Australian Information Commissioner. EEA and UK users
        can contact their local data protection authority. Paddle can also
        handle requests about payment data it holds.
      </p>

      <h2>14. Security</h2>
      <p>
        We use HTTPS, hashed passwords, and access controls on account and
        billing data. No method of transmission or storage is completely secure.
      </p>

      <h2>15. Children</h2>
      <p>
        {APP_NAME} is not directed at children under 16. We do not knowingly
        collect personal information from children.
      </p>

      <h2>16. Changes</h2>
      <p>
        We may update this policy when the product or the law changes. The “Last
        updated” date at the top will change. Continued use after an update means
        you accept the revised policy.
      </p>

      <h2>17. Contact</h2>
      <p>
        {sellerIdentity()}
        <br />
        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
