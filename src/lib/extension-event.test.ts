import { describe, expect, it } from "vitest";
import { claimedExtensionUserId } from "./extension-event";

describe("claimedExtensionUserId", () => {
  it("returns the user id when the pending flag was cleared", () => {
    expect(claimedExtensionUserId([{ id: "user-1" }])).toBe("user-1");
  });

  it("returns nothing when the flag was already clear", () => {
    expect(claimedExtensionUserId([])).toBeNull();
  });
});
