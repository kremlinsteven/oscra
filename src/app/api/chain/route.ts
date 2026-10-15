import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server/snapshot-cache";
import type { ChainSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";
export type { ChainSnapshot };

/* Live facts for the whole site (see src/lib/server/snapshot.ts), cached in src/lib/server/snapshot-cache.ts. */

export async function GET() {
  const value = await getSnapshot();
  if (!value) return NextResponse.json({ error: "Chain data is not available yet." }, { status: 503, headers: { "cache-control": "no-store" } });
  return NextResponse.json(value, { headers: { "cache-control": "no-store" } });
}
