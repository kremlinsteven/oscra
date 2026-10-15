import "server-only";
import { BRAND, TOKEN, TOKEN_DECIMALS, isAddress } from "@/config/brand";
import { rpc } from "@/lib/feeds/rpc";
import { memoryStore } from "@/lib/server/memstore";
import type { RecordDeps, TxFacts } from "@/lib/server/records";
import { getSnapshot } from "@/lib/server/snapshot-cache";
import { getStore, type Store } from "@/lib/server/store";
import { txFacts, type ParsedTx } from "@/lib/server/txfacts";

/*
 * Real readers for the records logic: KV when configured (kv-gateway, keys prefixed "oscra:"), else a bounded
 * in-process store (src/lib/server/memstore.ts) and the site shows "records are not configured".
 */

let mem: Store | null = null;
export const recordsConfigured = () => getStore() !== null;
/** Writes need the real store on a deployment; the in-memory fallback is for local runs only. */
export const recordsWritable = () => recordsConfigured() || (!process.env.VERCEL && process.env.OSCRA_REQUIRE_KV !== "1");
export function recordStore(): Store {
  return getStore() ?? (mem ??= memoryStore());
}

/** A confirmed swap can take a moment to be served by getTransaction, so a miss is retried briefly. */
async function readTx(signature: string, wallet: string): Promise<TxFacts | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    const tx = await rpc<ParsedTx | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
    const facts = txFacts(tx, wallet);
    if (facts) return facts;
  }
  return null;
}

async function tokenBalance(wallet: string): Promise<bigint | null> {
  if (!isAddress(BRAND.ca)) return null;
  const r = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>("getTokenAccountsByOwner", [wallet, { mint: BRAND.ca }, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return r.value.reduce((a, x) => a + BigInt(x.account.data.parsed.info.tokenAmount.amount), 0n);
}

export function recordDeps(): RecordDeps {
  return {
    store: recordStore(),
    now: () => Math.floor(Date.now() / 1000),
    price: async (lane) => (await getSnapshot())?.prices.find((p) => p.id === lane)?.price ?? null,
    tokenBalance,
    readTx,
    tokenLive: TOKEN.isLive,
    tokenDecimals: TOKEN_DECIMALS,
  };
}
