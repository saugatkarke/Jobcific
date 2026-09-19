import { getDb } from "./db";
import { atsScoreReservationUse } from "./schema";

type ReservationUseDb = {
  insert: ReturnType<typeof getDb>["insert"];
};

export async function claimAtsReservationUse(input: {
  reservationId: string;
  userId: string;
  db?: ReservationUseDb;
}): Promise<boolean> {
  const reservationId = String(input.reservationId || "").trim();
  const userId = String(input.userId || "").trim();
  if (!reservationId || !userId) {
    throw new Error("RESERVATION_INVALID");
  }
  const rows = await (input.db ?? getDb())
    .insert(atsScoreReservationUse)
    .values({ reservationId, userId, claimedAt: new Date() })
    .onConflictDoNothing()
    .returning({ reservationId: atsScoreReservationUse.reservationId });
  return rows.length === 1;
}
