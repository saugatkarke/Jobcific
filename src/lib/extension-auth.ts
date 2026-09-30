import { and, eq, gt, isNotNull, isNull, max } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "./db";
import {
  isAllowedRedirectUri,
  newSecret,
  pkceS256Challenge,
  sha256Hex,
} from "./crypto-hash";
import {
  extensionClientForRedirectUri,
  isExtensionClient,
  type ExtensionClient,
} from "./extensions";
import { extensionAuthCode, extensionRefreshToken, user } from "./schema";

export class GrantError extends Error {
  constructor(message = "INVALID_GRANT") {
    super(message);
    this.name = "GrantError";
  }
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: 900;
};

function secretKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function assertPkceMatch(verifier: string, challenge: string): void {
  if (pkceS256Challenge(verifier) !== challenge) {
    throw new GrantError();
  }
}

export function assertCodeUsable(row: {
  consumedAt: Date | null;
  expiresAt: Date;
  redirectUri: string;
}, now: Date, redirectUri: string): void {
  if (row.consumedAt) throw new GrantError();
  if (row.expiresAt.getTime() <= now.getTime()) throw new GrantError();
  if (row.redirectUri !== redirectUri) throw new GrantError();
}

export async function signAccessJwt(owner: {
  id: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ email: owner.email, typ: "extension" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(owner.id)
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function verifyAccessJwt(
  token: string,
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== "extension" || !payload.sub || !payload.email) {
      return null;
    }
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export async function insertAuthCode(args: {
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): Promise<string> {
  if (!isAllowedRedirectUri(args.redirectUri)) {
    throw new GrantError();
  }
  const raw = newSecret(32);
  const db = getDb();
  await db.insert(extensionAuthCode).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    codeHash: sha256Hex(raw),
    codeChallenge: args.codeChallenge,
    redirectUri: args.redirectUri,
    state: args.state,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    consumedAt: null,
  });
  return raw;
}

async function issueTokens(
  userId: string,
  email: string,
  client: string | null,
): Promise<TokenResponse> {
  const refresh = newSecret(32);
  const db = getDb();
  await db.insert(extensionRefreshToken).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: sha256Hex(refresh),
    client,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
  });
  return {
    access_token: await signAccessJwt({ id: userId, email }),
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: 900,
  };
}

export async function exchangeAuthorizationCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  if (!isAllowedRedirectUri(args.redirectUri)) {
    throw new GrantError();
  }
  const db = getDb();
  const hash = sha256Hex(args.code);
  const rows = await db
    .select()
    .from(extensionAuthCode)
    .where(eq(extensionAuthCode.codeHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row) throw new GrantError();
  assertCodeUsable(row, new Date(), args.redirectUri);
  assertPkceMatch(args.codeVerifier, row.codeChallenge);

  const owners = await db.select().from(user).where(eq(user.id, row.userId)).limit(1);
  const owner = owners[0];
  if (!owner) throw new GrantError();

  await db
    .update(extensionAuthCode)
    .set({ consumedAt: new Date() })
    .where(eq(extensionAuthCode.id, row.id));

  return issueTokens(
    owner.id,
    owner.email,
    extensionClientForRedirectUri(args.redirectUri),
  );
}

export async function rotateRefreshToken(refreshToken: string): Promise<TokenResponse> {
  const db = getDb();
  const hash = sha256Hex(refreshToken);
  const rows = await db
    .select()
    .from(extensionRefreshToken)
    .where(eq(extensionRefreshToken.tokenHash, hash))
    .limit(1);
  const row = rows[0];
  const now = Date.now();
  if (!row || row.revokedAt || row.expiresAt.getTime() <= now) {
    throw new GrantError();
  }
  const owners = await db.select().from(user).where(eq(user.id, row.userId)).limit(1);
  const owner = owners[0];
  if (!owner) throw new GrantError();

  await db
    .update(extensionRefreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(extensionRefreshToken.id, row.id));

  return issueTokens(owner.id, owner.email, row.client);
}

export async function listExtensionConnections(
  userId: string,
): Promise<{ client: ExtensionClient; lastSyncedAt: Date }[]> {
  const db = getDb();
  const rows = await db
    .select({
      client: extensionRefreshToken.client,
      lastSyncedAt: max(extensionRefreshToken.createdAt),
    })
    .from(extensionRefreshToken)
    .where(
      and(
        eq(extensionRefreshToken.userId, userId),
        isNotNull(extensionRefreshToken.client),
        isNull(extensionRefreshToken.revokedAt),
        gt(extensionRefreshToken.expiresAt, new Date()),
      ),
    )
    .groupBy(extensionRefreshToken.client);
  return rows.flatMap((row) =>
    isExtensionClient(row.client) && row.lastSyncedAt
      ? [{ client: row.client, lastSyncedAt: row.lastSyncedAt }]
      : [],
  );
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  const db = getDb();
  const hash = sha256Hex(refreshToken);
  await db
    .update(extensionRefreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(extensionRefreshToken.tokenHash, hash));
}
