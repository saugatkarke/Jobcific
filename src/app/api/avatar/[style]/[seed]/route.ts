import { NextResponse } from "next/server";
import { isAvatarSeed, isAvatarStyle } from "@/lib/avatar";
import { renderAvatarSvg } from "@/lib/avatar-render";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ style: string; seed: string }> },
) {
  const { style, seed } = await params;
  if (!isAvatarStyle(style) || !isAvatarSeed(seed)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const svg = await renderAvatarSvg({ style, seed });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
