import { test } from "node:test";
import assert from "node:assert/strict";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { USDC } from "@/config/brand";
import { LANES } from "@/config/lanes";
import { canonical, recordMessage, sha256Hex, type Action, type SignedRecord } from "@/lib/records-shared";
import { MEM_KEYS, memoryStore } from "./memstore";
import { NONCE_TTL, RecordError, applyRecord, canonicalS, issueNonce, readBoard, verifySigned, type RecordDeps } from "./records";

const kp = nacl.sign.keyPair();
const WALLET = bs58.encode(kp.publicKey);
const other = nacl.sign.keyPair();
const LEADER = bs58.encode(other.publicKey);
const T0 = 1_790_000_000;

async function signed(store: ReturnType<typeof memoryStore>, action: Action, payload: unknown, now = T0, key = kp): Promise<SignedRecord> {
  const wallet = bs58.encode(key.publicKey);
  const { nonce, issuedAt } = await issueNonce(store, wallet, now);
  const msg = recordMessage({ wallet, action, payloadHash: await sha256Hex(canonical(payload)), nonce, issuedAt });
  return { wallet, action, payload, nonce, issuedAt, signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), key.secretKey)) };
}

function deps(store: ReturnType<typeof memoryStore>, over: Partial<RecordDeps> = {}): RecordDeps {
  return { store, now: () => T0, price: async () => 100, tokenBalance: async () => 600_000n * 10n ** 6n, readTx: async () => null, tokenLive: true, tokenDecimals: 6, ...over };
}

const FOLLOW_TERMS = { perSignal: 25, dayCap: 100, maxCost: 0, laneMask: 3, reviewDelay: 0, slipBps: 100, chaseBps: 200, stopBps: 0 };

const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof RecordError && re.test(e.message));

test("a correctly signed record verifies once", async () => {
  const s = memoryStore(() => T0 * 1000);
  const r = await signed(s, "skip", { signal: 1 });
  await verifySigned(s, r, T0);
  await rejects(verifySigned(s, r, T0), /already used/);
});

test("tampered payload, wrong wallet, forged nonce and expiry are refused", async () => {
  const s = memoryStore(() => T0 * 1000);
  const r = await signed(s, "skip", { signal: 1 });
  await rejects(verifySigned(s, { ...r, payload: { signal: 2 } }, T0), /does not match/);
  await rejects(verifySigned(s, { ...r, wallet: LEADER }, T0), /not issued/);
  await rejects(verifySigned(s, { ...r, nonce: `${"0".repeat(32)}.${"0".repeat(64)}` }, T0), /not issued/);
  await rejects(verifySigned(s, r, T0 + NONCE_TTL + 1), /expired/);
  // A nonce from another server key does not verify here.
  const elsewhere = await signed(memoryStore(() => T0 * 1000), "skip", { signal: 1 });
  await rejects(verifySigned(s, elsewhere, T0), /not issued/);
});

test("nonces are stateless: issuing many for one wallet stores nothing per wallet and never blocks", async () => {
  const s = memoryStore(() => T0 * 1000);
  const before = s.size();
  for (let i = 0; i < 50; i++) await issueNonce(s, WALLET, T0);
  assert.ok(s.size() - before <= 1); // only the one server key
  const r = await signed(s, "skip", { signal: 3 });
  await verifySigned(s, r, T0);
});

test("the memory store refuses new keys when full instead of evicting live ones", async () => {
  const s = memoryStore(() => T0 * 1000);
  await s.set("follows:real", "keep");
  for (let i = 0; s.size() < MEM_KEYS; i++) await s.set(`flood:${i}`, "x");
  await assert.rejects(s.set("flood:more", "x"), /full/);
  assert.equal(await s.get("follows:real"), "keep");
});

test("memory entries never outlive one day", async () => {
  let now = T0 * 1000;
  const s = memoryStore(() => now);
  await s.set("k", "v");
  await s.setEx("k2", "v", 30 * 86_400);
  now += 86_401_000;
  assert.equal(await s.get("k"), null);
  assert.equal(await s.get("k2"), null);
});

test("follow terms are checked and a desk cannot follow itself", async () => {
  const s = memoryStore(() => T0 * 1000);
  const d = deps(s);
  const terms = { perSignal: 25, dayCap: 100, maxCost: 0, laneMask: 3, reviewDelay: 0, slipBps: 100, chaseBps: 200, stopBps: 0 };
  assert.match(await applyRecord(d, await signed(s, "follow", { leader: LEADER, terms })), /Following/);
  await rejects(applyRecord(d, await signed(s, "follow", { leader: WALLET, terms })), /other than your own/);
  await rejects(applyRecord(d, await signed(s, "follow", { leader: LEADER, terms: { ...terms, dayCap: 10 } })), /out of range/);
  await rejects(applyRecord(d, await signed(s, "follow", { leader: LEADER, terms: { ...terms, slipBps: 9000 } })), /Slippage/);
  const board = await readBoard(s, WALLET, { configured: false, tokenLive: true });
  assert.equal(board.mine?.follows.length, 1);
});

test("ideas carry the server price and are capped per desk per day", async () => {
  const s = memoryStore(() => T0 * 1000);
  const d = deps(s, { price: async () => 123.45 });
  const msg = await applyRecord(d, await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 5000 }, T0, other));
  assert.match(msg, /123\.45/);
  for (let i = 1; i < 20; i++) await applyRecord(d, await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 100 }, T0, other));
  await rejects(applyRecord(d, await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 100 }, T0, other)), /per day/);
  await rejects(applyRecord(d, await signed(s, "post-idea", { lane: 99, sell: false, weightBps: 100 }, T0, other)), /Bad idea/);
});

test("a copied fill must be this wallet's own successful swap in the idea's direction, recorded once", async () => {
  const s = memoryStore(() => T0 * 1000);
  const lane = LANES[1];
  const sig = "5".repeat(88);
  let facts = { ok: true, feePayer: WALLET, blockTime: T0, deltas: { [USDC.mint]: -25_000_000n, [lane.mint]: 11_000_000n } as Record<string, bigint> };
  const d = deps(s, { readTx: async () => facts });
  await applyRecord(d, await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 10_000 }, T0, other));
  // Not following the desk: refused before the transaction is even read.
  await rejects(applyRecord(d, await signed(s, "record-fill", { signal: 1, signature: sig })), /did not follow this desk/);
  await applyRecord(d, await signed(s, "follow", { leader: LEADER, terms: FOLLOW_TERMS }));
  facts = { ...facts, feePayer: LEADER };
  await rejects(applyRecord(d, await signed(s, "record-fill", { signal: 1, signature: sig })), /not paid by this wallet/);
  facts = { ...facts, feePayer: WALLET, deltas: { [USDC.mint]: 25_000_000n, [lane.mint]: -1n } };
  await rejects(applyRecord(d, await signed(s, "record-fill", { signal: 1, signature: sig })), /not a purchase/);
  facts = { ...facts, deltas: { [USDC.mint]: -25_000_000n, [lane.mint]: 11_000_000n } };
  assert.match(await applyRecord(d, await signed(s, "record-fill", { signal: 1, signature: sig })), /bought 0\.110000 NVDAx for 25\.00 USDC/);
  await rejects(applyRecord(d, await signed(s, "record-fill", { signal: 1, signature: sig })), /already handled/);
  // The same swap cannot be claimed for a second idea either.
  await applyRecord(d, await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 10_000 }, T0, other));
  await rejects(applyRecord(d, await signed(s, "record-fill", { signal: 2, signature: sig })), /already recorded/);
});

test("a fill is refused for an idea posted before the follow, for a swap older than the idea, and for a skipped idea", async () => {
  const s = memoryStore(() => T0 * 1000);
  const lane = LANES[1];
  const buy = { ok: true, feePayer: WALLET, blockTime: T0 + 20, deltas: { [USDC.mint]: -25_000_000n, [lane.mint]: 11_000_000n } as Record<string, bigint> };
  let facts = buy;
  const at = (t: number) => deps(s, { now: () => t, readTx: async () => facts });
  await applyRecord(at(T0), await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 10_000 }, T0, other));
  await applyRecord(at(T0 + 10), await signed(s, "follow", { leader: LEADER, terms: FOLLOW_TERMS }, T0 + 10));
  await rejects(applyRecord(at(T0 + 30), await signed(s, "record-fill", { signal: 1, signature: "6".repeat(88) }, T0 + 30)), /did not follow this desk/);
  await applyRecord(at(T0 + 40), await signed(s, "post-idea", { lane: 1, sell: false, weightBps: 10_000 }, T0 + 40, other));
  facts = { ...buy, blockTime: T0 + 35 };
  await rejects(applyRecord(at(T0 + 50), await signed(s, "record-fill", { signal: 2, signature: "7".repeat(88) }, T0 + 50)), /before the idea/);
  await applyRecord(at(T0 + 50), await signed(s, "skip", { signal: 2 }, T0 + 50));
  facts = { ...buy, blockTime: T0 + 45 };
  await rejects(applyRecord(at(T0 + 60), await signed(s, "record-fill", { signal: 2, signature: "7".repeat(88) }, T0 + 60)), /already handled/);
  // The refused fill did not burn the signature: nothing about it was stored.
  assert.equal(await s.get("fill-sig:" + "7".repeat(88)), null);
});

test("votes weigh the balance at vote time, once per wallet; polls need the proposer minimum", async () => {
  const s = memoryStore(() => T0 * 1000);
  const d = deps(s);
  await applyRecord(d, await signed(s, "open-poll", { title: "Next market?", choices: ["A", "B"], days: 3 }));
  await rejects(applyRecord(deps(s, { tokenBalance: async () => 10n }), await signed(s, "open-poll", { title: "x", choices: ["A", "B"], days: 3 }, T0, other)), /needs 500,000/);
  await applyRecord(deps(s, { tokenBalance: async () => 1_234_560_000n }), await signed(s, "vote", { poll: 1, choice: 1 }, T0, other));
  await rejects(applyRecord(d, await signed(s, "vote", { poll: 1, choice: 1 }, T0, other)), /already voted/);
  await rejects(applyRecord(deps(s, { now: () => T0 + 4 * 86_400 }), await signed(s, "vote", { poll: 1, choice: 0 }, T0 + 4 * 86_400)), /closed/);
  const board = await readBoard(s, LEADER, { configured: false, tokenLive: true });
  assert.deepEqual(board.polls[0].tally, [0, 1234.56]);
  assert.equal(board.mine?.votes[1], 1);
  await rejects(applyRecord(deps(s, { tokenLive: false }), await signed(s, "vote", { poll: 1, choice: 0 })), /once \$OSCRA is live/);
});

test("a malleable copy of a valid signature (S + L) is refused, and replay is keyed on the nonce", async () => {
  const s = memoryStore(() => T0 * 1000);
  const r = await signed(s, "skip", { signal: 9 });
  const sig = bs58.decode(r.signature);
  let v = 0n;
  for (let i = 63; i >= 32; i--) v = (v << 8n) | BigInt(sig[i]);
  v += (1n << 252n) + 27742317777372353535851937790883648493n;
  const forged = Uint8Array.from(sig);
  for (let i = 32; i < 64; i++) {
    forged[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  assert.equal(canonicalS(sig), true);
  assert.equal(canonicalS(forged), false);
  await rejects(verifySigned(s, { ...r, signature: bs58.encode(forged) }, T0), /Bad signature/);
  await verifySigned(s, r, T0);
  // A second, different signature over the same nonce still counts as a replay.
  await rejects(verifySigned(s, r, T0), /already used/);
});
