import { NextResponse } from "next/server";
import { TOKEN } from "@/config/brand";
import { readBody } from "@/lib/guard";
import { budget } from "@/lib/guard";
import { walletKey } from "@/lib/netkey";
import { spend } from "@/lib/ratelimit";
import type { SignedRecord } from "@/lib/records-shared";
import { RecordError, applyRecord, readBoard, verifySigned } from "@/lib/server/records";
import { recordDeps, recordStore, recordsConfigured, recordsWritable } from "@/lib/server/records-deps";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/*
 * Wallet-signed records: desk ideas, follows, skips, copied fills, polls and votes (src/lib/server/records.ts).
 * GET reads the board (and the caller's own records with ?wallet=). POST applies one signed record.
 * Limits: 60 writes per known client IP (a site-wide ceiling for unknown IPs) and 20 per verified wallet per 10 minutes;
 * bodies over 4 KB are refused. Writes fail closed (503) when the store is missing on a deployment or unreachable.
 */

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!(await budget(getStore(), request, "board", 1, 600, 30_000, 600))) return NextResponse.json({ error: "Too many reads. Slow down a little." }, { status: 429 });
  const board = await readBoard(recordStore(), wallet, { configured: recordsConfigured(), tokenLive: TOKEN.isLive }).catch(() => null);
  if (!board) return NextResponse.json({ error: "Records are unavailable right now." }, { status: 503 });
  return NextResponse.json(board, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const store = getStore();
  if (!recordsWritable()) return NextResponse.json({ error: "Records are not configured on this deployment yet." }, { status: 503 });
  if (!(await budget(store, request, "records", 1, 60, 3_000, 600))) return NextResponse.json({ error: "Too many writes from your network. Wait a few minutes." }, { status: 429 });
  const body = await readBody<SignedRecord>(request, 4096);
  if (!body.ok) return NextResponse.json({ error: body.tooLarge ? "Request too large." : "Invalid JSON." }, { status: body.tooLarge ? 413 : 400 });
  try {
    const deps = recordDeps();
    await verifySigned(deps.store, body.value);
    if (!(await spend(store, "records-w", walletKey(body.value.wallet), 1, 20, 600))) return NextResponse.json({ error: "Too many writes from this wallet. Wait a few minutes." }, { status: 429 });
    const message = await applyRecord(deps, body.value);
    return NextResponse.json({ ok: true, message }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof RecordError) return NextResponse.json({ error: e.message }, { status: e.status });
    // Store or upstream failure: fail closed, nothing was half-written in a way that counts.
    return NextResponse.json({ error: "Records are unavailable right now. Try again shortly." }, { status: 503 });
  }
}
