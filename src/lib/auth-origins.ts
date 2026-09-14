export function appTrustedOrigins(
  urls: Array<string | undefined> = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ],
): string[] {
  return [
    ...new Set(
      urls
        .map((url) => String(url || "").trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  ];
}

/**
 * Better Auth origin-check allows only this relative-path charset.
 * A `:` in the query (the extension `https://…chromiumapp.org` redirect) is rejected.
 */
export const BETTER_AUTH_RELATIVE_CALLBACK =
  /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/;

export function betterAuthAcceptsCallbackURL(url: string): boolean {
  return url.startsWith("/") && BETTER_AUTH_RELATIVE_CALLBACK.test(url);
}

export function authPageHref(path: "/login" | "/signup", nextPath: string): string {
  if (!nextPath.startsWith("/") || nextPath === "/account") return path;
  return `${path}?next=${encodeURIComponent(nextPath)}`;
}
