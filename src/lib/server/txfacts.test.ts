import { test } from "node:test";
import assert from "node:assert/strict";
import { USDC, WSOL_MINT } from "@/config/brand";
import { txFacts, type ParsedTx } from "./txfacts";

const W = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const POOL = "7xCs4HvmZfzq4QAt8vkoXjjF32c29qQRUGUfqQJjWyFY";
const bal = (mint: string, owner: string, amount: string) => ({ mint, owner, uiTokenAmount: { amount } });

test("a USDC -> SOL swap that unwraps to native SOL counts as a wrapped SOL purchase, fee added back", () => {
  // The temporary wSOL account was opened and closed inside the transaction, so no wSOL token balance appears.
  const tx: ParsedTx = {
    blockTime: 100,
    meta: {
      err: null,
      fee: 15_000,
      preBalances: [1_000_000_000, 5],
      postBalances: [1_000_000_000 + 250_000_000 - 15_000, 5],
      preTokenBalances: [bal(USDC.mint, W, "50000000"), bal(USDC.mint, POOL, "1")],
      postTokenBalances: [bal(USDC.mint, W, "25000000"), bal(USDC.mint, POOL, "25000001")],
    },
    transaction: { message: { accountKeys: [{ pubkey: W, signer: true }, { pubkey: POOL, signer: false }] } },
  };
  const f = txFacts(tx, W)!;
  assert.equal(f.ok, true);
  assert.equal(f.feePayer, W);
  assert.equal(f.deltas[USDC.mint], -25_000_000n);
  assert.equal(f.deltas[WSOL_MINT], 250_000_000n);
});

test("selling native SOL shows a negative wrapped SOL delta; a failed or missing tx is reported as such", () => {
  const tx: ParsedTx = {
    blockTime: 100,
    meta: { err: { InstructionError: [2, "Custom"] }, fee: 5_000, preBalances: [2_000_000_000], postBalances: [1_499_995_000], preTokenBalances: [], postTokenBalances: [bal(USDC.mint, W, "52000000")] },
    transaction: { message: { accountKeys: [W] } },
  };
  const f = txFacts(tx, W)!;
  assert.equal(f.ok, false);
  assert.equal(f.deltas[WSOL_MINT], -500_000_000n);
  assert.equal(f.deltas[USDC.mint], 52_000_000n);
  assert.equal(txFacts(null, W), null);
  assert.equal(txFacts({ ...tx, meta: null }, W), null);
});
