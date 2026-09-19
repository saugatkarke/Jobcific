import { describe, expect, it } from "vitest";
import { claimAtsReservationUse } from "./ats-reservation-use";

function createClaimDb(rows: Array<{ reservationId: string }>) {
  const state = { values: null as Record<string, unknown> | null };
  return {
    state,
    insert() {
      return {
        values(values: Record<string, unknown>) {
          state.values = values;
          return {
            onConflictDoNothing() {
              return { returning: async () => rows };
            },
          };
        },
      };
    },
  };
}

describe("claimAtsReservationUse", () => {
  it("claims a reservation exactly once", async () => {
    const first = createClaimDb([{ reservationId: "reservation-123" }]);
    expect(
      await claimAtsReservationUse({
        reservationId: "reservation-123",
        userId: "user_123",
        db: first as never,
      }),
    ).toBe(true);
    expect(first.state.values).toMatchObject({
      reservationId: "reservation-123",
      userId: "user_123",
    });

    const duplicate = createClaimDb([]);
    expect(
      await claimAtsReservationUse({
        reservationId: "reservation-123",
        userId: "user_123",
        db: duplicate as never,
      }),
    ).toBe(false);
  });

  it("rejects blank identifiers", async () => {
    await expect(
      claimAtsReservationUse({
        reservationId: "",
        userId: "user_123",
        db: createClaimDb([]) as never,
      }),
    ).rejects.toThrow("RESERVATION_INVALID");
  });
});
