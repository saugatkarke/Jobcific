import { describe, expect, it } from "vitest";
import { renderAvatarSvg } from "./avatar-render";
import { avatarBodyColor, inlineAvatarSvg } from "./avatar-svg";
import gaze from "@dicebear/styles/gaze.json";

describe("avatarBodyColor", () => {
  it("reads the body fill of a rendered gaze avatar", async () => {
    const palette = gaze.colors.body.values;
    const seeds = Array.from({ length: 60 }, (_, i) => `seed${i}`);
    for (const seed of seeds) {
      const svg = await renderAvatarSvg({ style: "gaze", seed });
      expect(palette).toContain(avatarBodyColor(svg));
    }
  });

  it("returns null when the svg has no body shape", () => {
    expect(avatarBodyColor('<svg><path fill="#123456"/></svg>')).toBeNull();
  });
});

describe("inlineAvatarSvg", () => {
  it("suffixes every id and every reference to it", async () => {
    const svg = await renderAvatarSvg({ style: "gaze", seed: "seed1" });
    const markup = inlineAvatarSvg(svg, "a1");
    const ids = Array.from(markup.matchAll(/\sid="([^"]+)"/g), (m) => m[1]);
    const refs = Array.from(
      markup.matchAll(/(?:href="#|url\(#)([^")]+)/g),
      (m) => m[1],
    );

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.endsWith("-a1"))).toBe(true);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((ref) => ids.includes(ref))).toBe(true);
  });

  it("gives two copies of one avatar distinct ids", async () => {
    const svg = await renderAvatarSvg({ style: "gaze", seed: "seed1" });
    const first = inlineAvatarSvg(svg, "a1").match(/\sid="([^"]+)"/)?.[1];
    const second = inlineAvatarSvg(svg, "b2").match(/\sid="([^"]+)"/)?.[1];
    expect(first).not.toBe(second);
  });

  it("drops styles, scripts, metadata and comments", () => {
    const markup = inlineAvatarSvg(
      '<svg><!-- c --><metadata>m</metadata><style>.x{}</style><script>alert(1)</script><g id="a"/></svg>',
      "s",
    );
    expect(markup).toBe('<svg><g id="a-s"/></svg>');
  });
});
