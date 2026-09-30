import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { user } from "./schema";

export function claimedExtensionUserId(rows: { id: string }[]): string | null {
  return rows[0]?.id ?? null;
}

export async function markExtensionEventPending(userId: string): Promise<void> {
  await getDb()
    .update(user)
    .set({ extensionEventPending: true })
    .where(eq(user.id, userId));
}

export async function claimExtensionEvent(userId: string): Promise<string | null> {
  const rows = await getDb()
    .update(user)
    .set({ extensionEventPending: false })
    .where(and(eq(user.id, userId), eq(user.extensionEventPending, true)))
    .returning({ id: user.id });
  return claimedExtensionUserId(rows);
}
