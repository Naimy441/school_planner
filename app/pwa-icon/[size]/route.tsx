import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/icon-art";

const SIZES = new Set([192, 512]);

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "512-maskable" }];
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const maskable = size.endsWith("-maskable");
  const n = parseInt(size, 10);
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<IconArt size={n} padded={maskable} />, { width: n, height: n });
}
