import { describe, expect, it } from "vitest";
import {
  EXTENSION_CONNECT_HREF,
  JOB_BOARD_LINKS,
} from "./portal-next-steps";

describe("portal next steps", () => {
  it("sends connect through the existing prepare handshake", () => {
    expect(EXTENSION_CONNECT_HREF).toBe("/extension/prepare");
  });

  it("lists Seek AU, Seek NZ, and Indeed as the next job boards", () => {
    expect(JOB_BOARD_LINKS.map((board) => [board.label, board.href])).toEqual([
      ["Seek Australia", "https://www.seek.com.au"],
      ["Seek New Zealand", "https://www.seek.co.nz"],
      ["Indeed", "https://www.indeed.com"],
    ]);
  });
});
