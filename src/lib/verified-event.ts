import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { user } from "./schema";

export function claimedVerifiedUserId(rows: { id: string }[]): string | null {
  return rows[0]?.id ?? null;
}

export async function markVerifiedEventPending(userId: string): Promise<void> {
  await getDb()
    .update(user)
    .set({ verifiedEventPending: true })
    .where(eq(user.id, userId));
}

export async function claimVerifiedEvent(userId: string): Promise<string | null> {
  const rows = await getDb()
    .update(user)
    .set({ verifiedEventPending: false })
    .where(and(eq(user.id, userId), eq(user.verifiedEventPending, true)))
    .returning({ id: user.id });
  return claimedVerifiedUserId(rows);
}
