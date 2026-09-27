import { Avatar, Style } from "@dicebear/core";
import { parseAvatarUrl, type AvatarChoice, type AvatarStyle } from "./avatar";
import { avatarBodyColor } from "./avatar-svg";

type Definition = { default: unknown };

const definitions: Record<AvatarStyle, () => Promise<Definition>> = {
  gaze: () => import("@dicebear/styles/gaze.json"),
};

const styles = new Map<AvatarStyle, Promise<Style>>();

function loadStyle(id: AvatarStyle) {
  let style = styles.get(id);
  if (!style) {
    style = definitions[id]().then((mod) => new Style(mod.default));
    style.catch(() => styles.delete(id));
    styles.set(id, style);
  }
  return style;
}

export async function renderAvatarSvg({ style, seed }: AvatarChoice) {
  return new Avatar(await loadStyle(style), { seed }).toString();
}

export async function avatarColorForUrl(url: string | null) {
  const choice = parseAvatarUrl(url);
  return choice ? avatarBodyColor(await renderAvatarSvg(choice)) : null;
}
