// The deployed build's id; clients compare it with their own to notice updates.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID || "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
