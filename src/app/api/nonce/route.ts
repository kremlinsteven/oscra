import { NextResponse } from "next/server";
import { budget } from "@/lib/guard";
import { RecordError, issueNonce } from "@/lib/server/records";
import { recordStore } from "@/lib/server/records-deps";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/*
 * Stateless nonce for a wallet-signed record (HMAC over wallet, time and randomness; nothing stored per wallet).
 * Limit: 60 per known client IP per 10 minutes; callers without a trusted IP share a site-wide ceiling.
 */
export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
  const store = getStore();
  if (!(await budget(store, request, "nonce", 1, 60, 6_000, 600))) return NextResponse.json({ error: "Too many sign requests from your network. Wait a few minutes." }, { status: 429 });
  try {
    const out = await issueNonce(recordStore(), wallet, Math.floor(Date.now() / 1000));
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const status = e instanceof RecordError ? e.status : 500;
    return NextResponse.json({ error: e instanceof RecordError ? e.message : "Could not issue a nonce." }, { status });
  }
}
