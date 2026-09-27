import { describe, expect, it } from "vitest";
import { AVATAR_STYLES } from "./avatar";
import { renderAvatarSvg } from "./avatar-render";

describe("renderAvatarSvg", () => {
  it("renders every offered style as svg", async () => {
    for (const { id } of AVATAR_STYLES) {
      const svg = await renderAvatarSvg({ style: id, seed: "seed1" });
      expect(svg.startsWith("<svg")).toBe(true);
    }
  });

  it("renders still avatars that keep the hooks our css animates", async () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const svg = await renderAvatarSvg({ style: "gaze", seed });
      expect(svg).not.toContain("<style");
      for (const hook of ["dbga-eye", "dbga-look", "dbga-hop"]) {
        expect(svg).toContain(`class="${hook}"`);
      }
    }
  });

  it("is deterministic for the same seed", async () => {
    const a = await renderAvatarSvg({ style: "gaze", seed: "same" });
    const b = await renderAvatarSvg({ style: "gaze", seed: "same" });
    const c = await renderAvatarSvg({ style: "gaze", seed: "other" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
