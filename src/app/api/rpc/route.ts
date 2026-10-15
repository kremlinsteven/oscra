import { NextResponse } from "next/server";
import { budget, readCapped } from "@/lib/guard";
import { getStore } from "@/lib/server/store";
import { RpcError, rpc, rpcBatch } from "@/lib/feeds/rpc";
import { BUDGET, MAX_BODY, runRelay, type Call } from "@/lib/relay";

export const dynamic = "force-dynamic";

/*
 * Solana JSON-RPC relay for the browser. The public RPC rate-limits browsers hard, so the site reads through its
 * own server first: balances, token accounts for the mints the site reads, account data, signature statuses and
 * transactions. It never forwards a signed transaction. A cost budget per known client network (IPv6 per /64), and a site-wide ceiling for callers without a trusted IP,
 * keep the RPC quota safe.
 * The rules are in src/lib/relay.ts; nothing reaches the RPC before they pass.
 */

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const text = await readCapped(request, MAX_BODY).catch(() => "");
  if (text === null) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: Call | Call[];
  try {
    body = JSON.parse(text) as Call | Call[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const store = getStore();
  const out = await runRelay(body, {
    charge: async (units) => {
      if (!(await budget(store, request, "rpc", units, BUDGET.units, BUDGET.siteUnits, BUDGET.windowSec))) return "Too many chain reads. Slow down a little.";
      return null;
    },
    one: async (method, params) => {
      try {
        return { result: await rpc<unknown>(method, params) };
      } catch (error) {
        if (error instanceof RpcError) return { error: { code: error.revert ? -32602 : -32000, message: error.message.slice(0, 300) } };
        return { down: true };
      }
    },
    many: (calls) => rpcBatch<unknown>(calls),
  });
  return NextResponse.json(out.body, { status: out.status, headers: { "cache-control": "no-store" } });
}
