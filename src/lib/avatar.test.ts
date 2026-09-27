import { describe, expect, it } from "vitest";
import {
  AVATAR_STYLES,
  avatarUrl,
  isAvatarSeed,
  parseAvatarUrl,
  randomAvatarSeeds,
  viewerAvatarUrl,
} from "./avatar";

describe("avatar urls", () => {
  it("round-trips a style and seed through the stored image path", () => {
    const url = avatarUrl({ style: "gaze", seed: "abc123" });
    expect(url).toBe("/api/avatar/gaze/abc123");
    expect(parseAvatarUrl(url)).toEqual({ style: "gaze", seed: "abc123" });
  });

  it("rejects images that are not our avatar paths", () => {
    expect(parseAvatarUrl(null)).toBeNull();
    expect(parseAvatarUrl("https://evil.example/x.png")).toBeNull();
    expect(parseAvatarUrl("/api/avatar/open-peeps/abc")).toBeNull();
    expect(parseAvatarUrl("/api/avatar/gaze/a b")).toBeNull();
    expect(parseAvatarUrl("/api/avatar/gaze/abc/extra")).toBeNull();
  });

  it("falls back to a default Gaze avatar seeded by the user id", () => {
    expect(viewerAvatarUrl(null, "user_1")).toBe("/api/avatar/gaze/user_1");
    expect(viewerAvatarUrl("/api/avatar/gaze/x9", "user_1")).toBe(
      "/api/avatar/gaze/x9",
    );
    expect(viewerAvatarUrl("/api/avatar/lorelei/x9", "user_1")).toBe(
      "/api/avatar/gaze/user_1",
    );
    expect(viewerAvatarUrl(null, null)).toBeNull();
  });
});

describe("avatar seeds", () => {
  it("only accepts short url-safe seeds", () => {
    expect(isAvatarSeed("abc-DEF_123")).toBe(true);
    expect(isAvatarSeed("")).toBe(false);
    expect(isAvatarSeed("a".repeat(65))).toBe(false);
    expect(isAvatarSeed("../etc")).toBe(false);
    expect(isAvatarSeed(42)).toBe(false);
  });

  it("generates valid seeds", () => {
    const seeds = randomAvatarSeeds(12);
    expect(seeds).toHaveLength(12);
    expect(seeds.every(isAvatarSeed)).toBe(true);
    expect(new Set(seeds).size).toBe(12);
  });

  it("offers only the Gaze style", () => {
    expect(AVATAR_STYLES.map((style) => style.id)).toEqual(["gaze"]);
  });
});
