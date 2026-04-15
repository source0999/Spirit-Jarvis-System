import { readSonicContext } from "@/lib/sonic-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sonic = await readSonicContext();
  return Response.json(sonic, {
    headers: { "Cache-Control": "no-store" },
  });
}
