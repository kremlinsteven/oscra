import { WSOL_MINT } from "@/config/brand";
import type { TxFacts } from "@/lib/server/records";

/*
 * Turns a jsonParsed getTransaction result into the facts a copied fill is checked against: success, fee payer,
 * block time and the wallet's balance change per mint.
 *
 * Native SOL counts as wrapped SOL. A Jupiter swap built with wrapAndUnwrapSol opens a temporary wSOL account and
 * closes it in the same transaction, so that account never shows up in pre/post token balances; the SOL the wallet
 * gained or spent only shows in its lamport balance. The network fee the wallet paid is added back so it is not
 * mistaken for a sale. (Rent for token accounts opened in the same transaction is still included: a few thousandths
 * of a SOL, never enough to flip the direction of a real swap.)
 */

type Bal = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
type Key = { pubkey: string; signer?: boolean } | string;

export type ParsedTx = {
  blockTime: number | null;
  meta: { err: unknown; fee?: number; preBalances?: number[]; postBalances?: number[]; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] } | null;
  transaction: { message: { accountKeys: Key[] } };
};

const keyOf = (k: Key) => (typeof k === "string" ? k : k.pubkey);

export function txFacts(tx: ParsedTx | null, wallet: string): TxFacts | null {
  if (!tx || !tx.meta) return null;
  const keys = tx.transaction.message.accountKeys.map(keyOf);
  const feePayer = keys[0] ?? "";
  const deltas: Record<string, bigint> = {};
  for (const b of tx.meta.postTokenBalances ?? []) if (b.owner === wallet) deltas[b.mint] = (deltas[b.mint] ?? 0n) + BigInt(b.uiTokenAmount.amount);
  for (const b of tx.meta.preTokenBalances ?? []) if (b.owner === wallet) deltas[b.mint] = (deltas[b.mint] ?? 0n) - BigInt(b.uiTokenAmount.amount);
  const i = keys.indexOf(wallet);
  const pre = tx.meta.preBalances?.[i];
  const post = tx.meta.postBalances?.[i];
  if (i >= 0 && typeof pre === "number" && typeof post === "number") {
    const fee = i === 0 ? BigInt(tx.meta.fee ?? 0) : 0n;
    const lamports = BigInt(post) - BigInt(pre) + fee;
    if (lamports !== 0n) deltas[WSOL_MINT] = (deltas[WSOL_MINT] ?? 0n) + lamports;
  }
  return { ok: tx.meta.err === null, feePayer, blockTime: tx.blockTime, deltas };
}
