import { INDEED_CWS_URL, SEEK_CWS_URL } from "./cws";

export type ExtensionClient = "seek" | "indeed";

export type ExtensionConnection = {
  client: ExtensionClient;
  syncedLabel: string;
};

type ExtensionInfo = {
  client: ExtensionClient;
  name: string;
  /* Chrome Web Store ID first, then the unpacked development ID. */
  ids: readonly string[];
  cwsUrl: string;
};

export const EXTENSIONS: readonly ExtensionInfo[] = [
  {
    client: "seek",
    name: "Seek",
    ids: ["mpglbfbnhhnbbilpnihnjhcencoijiep", "omdijdkofmlgjjipfaknienpebhoafem"],
    cwsUrl: SEEK_CWS_URL,
  },
  {
    client: "indeed",
    name: "Indeed",
    ids: ["lhkokphioeoagcpblnlidbehgpcbpgho", "mamnkbcandbeclhpambinlemkfggkcok"],
    cwsUrl: INDEED_CWS_URL,
  },
];

export function extensionClientForRedirectUri(uri: string): ExtensionClient | null {
  let host: string;
  try {
    host = new URL(uri).hostname;
  } catch {
    return null;
  }
  const match = /^([a-p]{32})\.chromiumapp\.org$/.exec(host);
  if (!match) return null;
  return EXTENSIONS.find((ext) => ext.ids.includes(match[1]))?.client ?? null;
}

export function isExtensionClient(value: unknown): value is ExtensionClient {
  return EXTENSIONS.some((ext) => ext.client === value);
}

export function syncedAgoLabel(at: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days} ${days === 1 ? "day" : "days"} ago`;
}
