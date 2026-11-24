import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";
import { APP_NAME, DISCLAIMER } from "../src/lib/copy";

const SITE_URL = "https://www.jobcific.com";
const DEFAULT_LOGO_SRC = `${SITE_URL}/Jobcific-logo-white-bg.png`;

export type PlanChangeEmailProps = {
  name?: string;
  /* For example "Panorama (Indeed, LinkedIn, Seek)". */
  currentPlan: string;
  nextPlan: string;
  /* For example "December 21, 2026". */
  effectiveDate: string;
  /* For example "$4.99 a month". */
  nextPrice: string;
  accountUrl: string;
  logoSrc?: string;
};

export const PLAN_CHANGE_SUBJECT = `Your ${APP_NAME} plan change is scheduled`;

export function PlanChangeEmail({
  name,
  currentPlan,
  nextPlan,
  effectiveDate,
  nextPrice,
  accountUrl,
  logoSrc = DEFAULT_LOGO_SRC,
}: PlanChangeEmailProps) {
  const who = name?.trim();
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: { ink: "#000000", muted: "#5b6470", line: "#e4e8ee" },
            },
          },
        }}
      >
        <Head />
        <Body className="bg-[#f4f6f8] font-sans text-ink">
          <Preview>{`Your plan changes to ${nextPlan} on ${effectiveDate}`}</Preview>
          <Container className="mx-auto my-8 max-w-xl bg-white p-8">
            <Section>
              <Link href={SITE_URL}>
                <Img
                  src={logoSrc}
                  alt={`${APP_NAME} home`}
                  width="140"
                  height="35"
                  className="block h-[35px] w-[140px] object-contain"
                  style={{ objectFit: "contain" }}
                />
              </Link>
            </Section>
            <Hr className="my-6 border-solid border-line" />
            <Heading as="h1" className="m-0 text-[24px] font-bold text-ink">
              Your plan change is scheduled
            </Heading>
            <Text className="mt-4 text-[15px] leading-[24px] text-ink">
              {who ? `Hi ${who},` : "Hi,"} your plan changes from {currentPlan} to{" "}
              {nextPlan} on {effectiveDate}.
            </Text>
            <Text className="text-[15px] leading-[24px] text-ink">
              Until then you keep everything in {currentPlan}. From {effectiveDate} you
              pay {nextPrice}, and Pro works only on the extensions in {nextPlan}.
            </Text>
            <Section className="my-6">
              <Button
                href={accountUrl}
                className="box-border rounded-[50px] bg-ink px-5 py-3 text-center text-[14px] font-medium text-white no-underline"
              >
                View or undo the change
              </Button>
            </Section>
            <Hr className="my-6 border-solid border-line" />
            <Text className="m-0 text-[13px] leading-[20px] text-muted">
              Changed your mind? Choose &quot;Keep my current plan&quot; on your account
              page before {effectiveDate}.
            </Text>
            <Text className="mt-4 text-[12px] leading-[18px] text-muted">
              <Link href={SITE_URL} className="text-muted no-underline">
                {APP_NAME}
              </Link>
              {" · "}
              {DISCLAIMER}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

PlanChangeEmail.PreviewProps = {
  name: "Sam",
  currentPlan: "Panorama (Indeed, LinkedIn, Seek)",
  nextPlan: "Lens (Seek)",
  effectiveDate: "December 21, 2026",
  nextPrice: "$4.99 a month",
  accountUrl: "https://www.jobcific.com/account",
  logoSrc: "/static/jobcific-logo.png",
} satisfies PlanChangeEmailProps;
