import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { getDb } from "./db";
import { sendAuthEmail } from "./mail";
import { markVerifiedEventPending } from "./verified-event";
import { appTrustedOrigins } from "./auth-origins";
import { APP_NAME } from "./copy";
import * as schema from "./schema";

export type Auth = ReturnType<typeof createAuth>;

function createAuth() {
  return betterAuth({
    appName: APP_NAME,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: appTrustedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          kind: "reset",
          url,
          name: user.name,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail({
          to: user.email,
          kind: "verify",
          url,
          name: user.name,
        });
      },
      afterEmailVerification: async (user) => {
        try {
          await markVerifiedEventPending(user.id);
        } catch (error) {
          console.error(
            "Could not record email verification for analytics",
            error,
          );
        }
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendAuthEmail({
            to: email,
            kind: "magic-link",
            url,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

let cached: Auth | null = null;

export function getAuth(): Auth {
  if (!cached) cached = createAuth();
  return cached;
}
