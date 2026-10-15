import "server-only";
import { BRAND, TOKEN, TOKEN_DECIMALS, isAddress } from "@/config/brand";
import { rpc } from "@/lib/feeds/rpc";
import { memoryStore } from "@/lib/server/memstore";
import type { RecordDeps, TxFacts } from "@/lib/server/records";
import { getSnapshot } from "@/lib/server/snapshot-cache";
import { getStore, type Store } from "@/lib/server/store";

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

type ParsedTx = {
  blockTime: number | null;
  meta: { err: unknown; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] } | null;
  transaction: { message: { accountKeys: ({ pubkey: string; signer: boolean } | string)[] } };
};
type Bal = { mint: string; owner?: string; uiTokenAmount: { amount: string } };

async function readTx(signature: string, wallet: string): Promise<TxFacts | null> {
  const tx = await rpc<ParsedTx | null>("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
  if (!tx || !tx.meta) return null;
  const first = tx.transaction.message.accountKeys[0];
  const feePayer = typeof first === "string" ? first : first.pubkey;
  const deltas: Record<string, bigint> = {};
  for (const b of tx.meta.postTokenBalances ?? []) if (b.owner === wallet) deltas[b.mint] = (deltas[b.mint] ?? 0n) + BigInt(b.uiTokenAmount.amount);
  for (const b of tx.meta.preTokenBalances ?? []) if (b.owner === wallet) deltas[b.mint] = (deltas[b.mint] ?? 0n) - BigInt(b.uiTokenAmount.amount);
  return { ok: tx.meta.err === null, feePayer, blockTime: tx.blockTime, deltas };
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
