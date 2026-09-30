import { describe, expect, it } from "vitest";
import {
  EXTENSIONS,
  extensionClientForRedirectUri,
  syncedAgoLabel,
} from "./extensions";
import { INDEED_CWS_URL, SEEK_CWS_URL } from "./cws";

describe("extension registry", () => {
  it("lists Seek and Indeed with their store links", () => {
    expect(EXTENSIONS.map((ext) => ext.client)).toEqual(["seek", "indeed"]);
    expect(EXTENSIONS[0].cwsUrl).toBe(SEEK_CWS_URL);
    expect(EXTENSIONS[1].cwsUrl).toBe(INDEED_CWS_URL);
  });

  it("maps store and unpacked redirect URIs to their extension", () => {
    expect(
      extensionClientForRedirectUri("https://mpglbfbnhhnbbilpnihnjhcencoijiep.chromiumapp.org/"),
    ).toBe("seek");
    expect(
      extensionClientForRedirectUri("https://omdijdkofmlgjjipfaknienpebhoafem.chromiumapp.org/"),
    ).toBe("seek");
    expect(
      extensionClientForRedirectUri("https://lhkokphioeoagcpblnlidbehgpcbpgho.chromiumapp.org/"),
    ).toBe("indeed");
    expect(
      extensionClientForRedirectUri("https://mamnkbcandbeclhpambinlemkfggkcok.chromiumapp.org/"),
    ).toBe("indeed");
  });

  it("returns null for unknown or malformed redirect URIs", () => {
    expect(
      extensionClientForRedirectUri("https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/"),
    ).toBeNull();
    expect(
      extensionClientForRedirectUri("https://mpglbfbnhhnbbilpnihnjhcencoijiep.evil.example/"),
    ).toBeNull();
    expect(extensionClientForRedirectUri("not a url")).toBeNull();
  });
});

describe("syncedAgoLabel", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("describes recent syncs in plain words", () => {
    expect(syncedAgoLabel(ago(20 * 1000), now)).toBe("Synced just now");
    expect(syncedAgoLabel(ago(5 * 60 * 1000), now)).toBe("Synced 5 min ago");
    expect(syncedAgoLabel(ago(3 * 60 * 60 * 1000), now)).toBe("Synced 3 hr ago");
    expect(syncedAgoLabel(ago(24 * 60 * 60 * 1000), now)).toBe("Synced 1 day ago");
    expect(syncedAgoLabel(ago(4 * 24 * 60 * 60 * 1000), now)).toBe("Synced 4 days ago");
  });
});
