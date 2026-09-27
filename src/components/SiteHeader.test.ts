import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("site header session state", () => {
  const header = readFileSync("src/components/SiteHeader.tsx", "utf8");

  it("shows a skeleton while the session is loading instead of the signed-out actions", () => {
    expect(header).toContain(
      "const { email, name, avatar, loading, signingOut, signOut } = useSession()",
    );
    expect(header).toContain("function HeaderSessionSkeleton");
    const actions = header.slice(header.indexOf("{loading ?"));
    expect(actions.indexOf("<HeaderSessionSkeleton")).toBeLessThan(
      actions.indexOf('href="/login"'),
    );
  });

  it("sizes the skeleton like the signed-in avatar and sign out, not a button", () => {
    const skeleton = header.slice(
      header.indexOf("function HeaderSessionSkeleton"),
      header.indexOf("export function SiteHeader"),
    );
    expect(skeleton).toContain(
      '<SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />',
    );
    expect(skeleton).toContain('<SkeletonBlock className="h-6 w-6 shrink-0" />');
    expect(skeleton).not.toContain("<Skeleton>Sign out</Skeleton>");
    expect(skeleton).not.toContain("btn-primary");
  });

  it("renders sign out as a larger dark red icon with an accessible label", () => {
    const button = header.slice(
      header.indexOf("onClick={signOut}"),
      header.indexOf("</button>", header.indexOf("onClick={signOut}")),
    );
    expect(button).toContain('aria-label="Sign out"');
    expect(button).toContain("text-red-800");
    expect(button).toContain('<IconLogout className="h-6 w-6 shrink-0" />');
    expect(button.slice(button.indexOf("<IconLogout"))).not.toContain("Sign out");
  });

  it("shows the user's unframed avatar and name, animating on hover", () => {
    const link = header.slice(
      header.indexOf('href="/account"'),
      header.indexOf("</Link>", header.indexOf('href="/account"')),
    );
    expect(link).toContain('motion="hover"');
    expect(link).toContain("framed={false}");
    expect(link).toContain('{name || "Account"}');
    expect(header).not.toContain("IconUser");
  });

  it("reserves space for the name while the session loads", () => {
    const skeleton = header.slice(
      header.indexOf("function HeaderSessionSkeleton"),
      header.indexOf("export function SiteHeader"),
    );
    expect(skeleton).toContain("<Skeleton>Your name</Skeleton>");
  });
});
