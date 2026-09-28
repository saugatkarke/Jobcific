import { describe, expect, it } from "vitest";
import { claimedVerifiedUserId } from "./verified-event";

describe("claimedVerifiedUserId", () => {
  it("returns the user id when the pending flag was cleared", () => {
    expect(claimedVerifiedUserId([{ id: "user-1" }])).toBe("user-1");
  });

  it("returns nothing when the flag was already clear", () => {
    expect(claimedVerifiedUserId([])).toBeNull();
  });
});
