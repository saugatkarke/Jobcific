const STRIPPED_ELEMENTS = /<(style|script|metadata)\b[\s\S]*?<\/\1>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const ID_ATTRIBUTE = /\sid="([^"]+)"/g;
const ID_REFERENCE = /(\sid="|href="#|url\(#)([^")]+)/g;
const BODY_FILL = /<g id="shape-[^"]*">\s*<[a-z]+\b[^>]*\sfill="(#[0-9a-fA-F]{6})"/;

export function avatarBodyColor(svg: string): string | null {
  return svg.match(BODY_FILL)?.[1].toLowerCase() ?? null;
}

// The same avatar can be inlined twice on one page (header and dashboard), and
// <use href="#id"> resolves to the first match in the document, so ids must be unique per copy.
export function inlineAvatarSvg(svg: string, suffix: string) {
  const markup = svg.replace(STRIPPED_ELEMENTS, "").replace(COMMENTS, "");
  const ids = new Set(Array.from(markup.matchAll(ID_ATTRIBUTE), (m) => m[1]));
  return markup.replace(ID_REFERENCE, (match, prefix: string, id: string) =>
    ids.has(id) ? `${prefix}${id}-${suffix}` : match,
  );
}
