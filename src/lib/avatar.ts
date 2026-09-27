// Gaze is CC0, so it needs no on-site artist credit.
export const AVATAR_STYLES = [{ id: "gaze", label: "Gaze" }] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

export type AvatarChoice = { style: AvatarStyle; seed: string };

export const DEFAULT_AVATAR_STYLE: AvatarStyle = "gaze";

const AVATAR_PATH = "/api/avatar/";
const SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return AVATAR_STYLES.some((style) => style.id === value);
}

export function isAvatarSeed(value: unknown): value is string {
  return typeof value === "string" && SEED_PATTERN.test(value);
}

export function avatarUrl({ style, seed }: AvatarChoice) {
  return `${AVATAR_PATH}${style}/${seed}`;
}

export function parseAvatarUrl(
  image: string | null | undefined,
): AvatarChoice | null {
  if (!image?.startsWith(AVATAR_PATH)) return null;
  const [style, seed, ...rest] = image.slice(AVATAR_PATH.length).split("/");
  if (rest.length || !isAvatarStyle(style) || !isAvatarSeed(seed)) return null;
  return { style, seed };
}

export function viewerAvatarUrl(
  image: string | null | undefined,
  fallbackSeed: string | null | undefined,
) {
  const choice = parseAvatarUrl(image);
  if (choice) return avatarUrl(choice);
  if (isAvatarSeed(fallbackSeed)) {
    return avatarUrl({ style: DEFAULT_AVATAR_STYLE, seed: fallbackSeed });
  }
  return null;
}

export function randomAvatarSeeds(count: number, random = Math.random) {
  return Array.from({ length: count }, () =>
    Array.from(
      { length: 10 },
      () => SEED_ALPHABET[Math.floor(random() * SEED_ALPHABET.length)],
    ).join(""),
  );
}
