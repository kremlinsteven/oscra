import bs58 from "bs58";
import nacl from "tweetnacl";
import { USDC } from "@/config/brand";
import { LANES, LIMITS, PRACTICE_TERMS } from "@/config/lanes";
import {
  ACTIONS,
  canonical,
  recordMessage,
  sha256Hex,
  type Action,
  type Board,
  type Fill,
  type FollowRecord,
  type FollowTerms,
  type Idea,
  type Poll,
  type SignedRecord,
} from "@/lib/records-shared";
import type { Store } from "@/lib/server/store";

/*
 * Server side of the wallet-signed records (desk ideas, follows, skips, copied fills, polls, votes). Pure logic over
 * an injected store and readers, so it is tested without a network. Abuse limits:
 *   - nonces are stateless: random + HMAC-SHA256(server key, wallet|issuedAt|random), valid NONCE_TTL seconds;
 *     nothing is stored per wallet, so nobody can replace or exhaust another wallet's nonces,
 *   - a signed record is accepted once: single use is keyed on the nonce's random part (from the signed message),
 *     never on signature bytes, and non-canonical signatures (S >= L) are refused,
 *   - the routes add generous per-IP budgets only (see src/app/api/nonce and src/app/api/records),
 *   - every list is capped, every string is bounded, and a wallet has at most MAX_FOLLOWS follows.
 */

export const NONCE_TTL = 300;
export const MAX_FOLLOWS = 20;
export const MAX_IDEAS = 300;
export const MAX_FILLS = 200;
export const MAX_HANDLED = 400;
export const MAX_POLLS = 50;
export const IDEAS_PER_DAY = 20;
const DAY = 86_400;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIG58 = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

export class RecordError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type TxFacts = { ok: boolean; feePayer: string; blockTime: number | null; deltas: Record<string, bigint> };

export type RecordDeps = {
  store: Store;
  now: () => number;
  /** USD price of a lane right now, or null when unknown. */
  price: (lane: number) => Promise<number | null>;
  /** $OSCRA base units the wallet holds right now (null when the token is not live). */
  tokenBalance: (wallet: string) => Promise<bigint | null>;
  /** A confirmed transaction's fee payer and the wallet's token deltas by mint, or null when not found. */
  readTx: (signature: string, wallet: string) => Promise<TxFacts | null>;
  tokenLive: boolean;
  tokenDecimals: number;
};

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

/** The HMAC key: created once in the store (SET NX), or per process for the in-memory fallback. */
export async function nonceKey(store: Store): Promise<string> {
  const fresh = hex(nacl.randomBytes(32));
  await store.setNx("nonce-key", fresh, 365 * DAY);
  return (await store.get("nonce-key")) ?? fresh;
}

async function hmac(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text))));
}

export async function issueNonce(store: Store, wallet: string, now: number) {
  if (!BASE58.test(wallet)) throw new RecordError("Not a Solana address.");
  const issuedAt = new Date(now * 1000).toISOString();
  const rand = hex(nacl.randomBytes(16));
  const mac = await hmac(await nonceKey(store), `${wallet}|${issuedAt}|${rand}`);
  return { nonce: `${rand}.${mac}`, issuedAt };
}

/** ed25519 group order L. A signature whose S half is not below L is a malleable copy and is refused. */
const L = (1n << 252n) + 27742317777372353535851937790883648493n;
export function canonicalS(sig: Uint8Array): boolean {
  let s = 0n;
  for (let i = 63; i >= 32; i--) s = (s << 8n) | BigInt(sig[i]);
  return s < L;
}

/** Checks the nonce MAC and window, the ed25519 signature, and that this exact record was not used before. */
export async function verifySigned(store: Store, r: SignedRecord, now: number = Math.floor(Date.now() / 1000)): Promise<void> {
  if (!r || typeof r !== "object") throw new RecordError("Bad record.");
  if (typeof r.wallet !== "string" || !BASE58.test(r.wallet)) throw new RecordError("Not a Solana address.");
  if (!ACTIONS.includes(r.action)) throw new RecordError("Unknown action.");
  if (typeof r.nonce !== "string" || !/^[0-9a-f]{32}\.[0-9a-f]{64}$/.test(r.nonce)) throw new RecordError("Bad nonce.");
  if (typeof r.issuedAt !== "string" || r.issuedAt.length > 40) throw new RecordError("Bad timestamp.");
  if (typeof r.signature !== "string" || r.signature.length > 120) throw new RecordError("Bad signature.");
  const at = Date.parse(r.issuedAt) / 1000;
  if (!Number.isFinite(at) || at > now + 30 || now - at > NONCE_TTL) throw new RecordError("Sign request expired. Try again.", 401);
  const [rand, mac] = r.nonce.split(".");
  const want = await hmac(await nonceKey(store), `${r.wallet}|${r.issuedAt}|${rand}`);
  let diff = want.length ^ mac.length;
  for (let i = 0; i < Math.min(want.length, mac.length); i++) diff |= want.charCodeAt(i) ^ mac.charCodeAt(i);
  if (diff !== 0) throw new RecordError("Sign request not issued by this site.", 401);
  let sig: Uint8Array;
  let key: Uint8Array;
  try {
    sig = bs58.decode(r.signature);
    key = bs58.decode(r.wallet);
  } catch {
    throw new RecordError("Bad signature.", 401);
  }
  if (sig.length !== 64 || key.length !== 32) throw new RecordError("Bad signature.", 401);
  if (!canonicalS(sig)) throw new RecordError("Bad signature.", 401);
  const message = recordMessage({ wallet: r.wallet, action: r.action, payloadHash: await sha256Hex(canonical(r.payload)), nonce: r.nonce, issuedAt: r.issuedAt });
  if (!nacl.sign.detached.verify(new TextEncoder().encode(message), sig, key)) throw new RecordError("Signature does not match this wallet.", 401);
  // Only a valid signature reaches this marker, so it cannot be planted for someone else.
  if (!(await store.setNx(`used:${rand}`, "1", NONCE_TTL + 60))) throw new RecordError("This signed request was already used.", 409);
}

const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

export function checkFollowTerms(t: FollowTerms) {
  if (!t || typeof t !== "object") throw new RecordError("Bad terms.");
  if (!num(t.perSignal, LIMITS.minSpend, 1e7) || !num(t.dayCap, t.perSignal, 1e8)) throw new RecordError("Per-idea amount or daily cap out of range.");
  if (!num(t.maxCost, 0, 1e8) || (t.maxCost !== 0 && t.maxCost < t.perSignal)) throw new RecordError("Position cap must be 0 (none) or at least one idea.");
  if (!int(t.laneMask, 1, (1 << LANES.length) - 1)) throw new RecordError("Pick at least one market.");
  if (!int(t.reviewDelay, 0, LIMITS.maxReviewDelayH * 3600)) throw new RecordError("Review delay out of range.");
  if (!int(t.slipBps, LIMITS.minSlipBps, LIMITS.maxSlipBps)) throw new RecordError("Slippage out of range.");
  if (!int(t.chaseBps, 0, LIMITS.maxChaseBps) || !int(t.stopBps, 0, LIMITS.maxGuardBps)) throw new RecordError("Chase or stop out of range.");
}

const parse = <T>(v: string | null, fallback: T): T => {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

/** Applies a verified record. Returns a short confirmation. */
export async function applyRecord(d: RecordDeps, r: SignedRecord): Promise<string> {
  const { store } = d;
  const now = d.now();
  const w = r.wallet;
  const p = (r.payload ?? {}) as Record<string, unknown>;
  switch (r.action as Action) {
    case "post-idea": {
      if (!int(p.lane, 0, LANES.length - 1) || typeof p.sell !== "boolean" || !int(p.weightBps, 1, 10_000)) throw new RecordError("Bad idea.");
      const today = await store.incrEx(`ideas-n:${w}`, DAY);
      if (today > IDEAS_PER_DAY) throw new RecordError(`At most ${IDEAS_PER_DAY} ideas per desk per day.`, 429);
      const price = await d.price(p.lane as number);
      if (!(price && price > 0)) throw new RecordError("No live price for this market right now. Try again shortly.", 503);
      const id = await store.incr("idea-seq");
      const idea: Idea = { id, leader: w, lane: p.lane as number, sell: p.sell, weightBps: p.weightBps as number, at: now, price };
      await store.pushCapped("ideas", JSON.stringify(idea), MAX_IDEAS);
      return `Idea #${id} posted at $${price.toFixed(2)}.`;
    }
    case "follow": {
      const leader = p.leader;
      if (typeof leader !== "string" || !BASE58.test(leader) || leader === w) throw new RecordError("Pick a desk wallet other than your own.");
      const terms = p.terms as FollowTerms;
      checkFollowTerms(terms);
      const follows = parse<FollowRecord[]>(await store.get(`follows:${w}`), []);
      const prev = follows.find((f) => f.leader === leader);
      if (!prev && follows.length >= MAX_FOLLOWS) throw new RecordError(`At most ${MAX_FOLLOWS} desks per wallet.`);
      const rec: FollowRecord = {
        leader,
        since: prev ? prev.since : now,
        perSignal: terms.perSignal,
        dayCap: terms.dayCap,
        maxCost: terms.maxCost,
        laneMask: terms.laneMask,
        reviewDelay: terms.reviewDelay,
        slipBps: terms.slipBps,
        chaseBps: terms.chaseBps,
        stopBps: terms.stopBps,
      };
      await store.set(`follows:${w}`, JSON.stringify([rec, ...follows.filter((f) => f.leader !== leader)]));
      return prev ? "Limits updated." : "Following. Only ideas posted from now on count.";
    }
    case "unfollow": {
      const follows = parse<FollowRecord[]>(await store.get(`follows:${w}`), []);
      if (!follows.some((f) => f.leader === p.leader)) throw new RecordError("Not following that desk.");
      await store.set(`follows:${w}`, JSON.stringify(follows.filter((f) => f.leader !== p.leader)));
      return "Stopped following.";
    }
    case "skip": {
      if (!int(p.signal, 1, Number.MAX_SAFE_INTEGER)) throw new RecordError("Unknown idea.");
      await markHandled(store, w, p.signal as number, "skipped");
      return `Skipped idea #${p.signal}.`;
    }
    case "record-fill": {
      if (!int(p.signal, 1, Number.MAX_SAFE_INTEGER) || typeof p.signature !== "string" || !SIG58.test(p.signature)) throw new RecordError("Bad fill.");
      const ideas = (await store.range("ideas", MAX_IDEAS)).map((x) => parse<Idea | null>(x, null)).filter(Boolean) as Idea[];
      const idea = ideas.find((i) => i.id === p.signal);
      if (!idea) throw new RecordError("Unknown idea.");
      // Only an idea from a desk this wallet followed before it was posted can be copied, and only once.
      const follow = parse<FollowRecord[]>(await store.get(`follows:${w}`), []).find((f) => f.leader === idea.leader);
      if (!follow || idea.at < follow.since) throw new RecordError("You did not follow this desk when the idea was posted.");
      if (parse<Record<string, string>>(await store.get(`handled:${w}`), {})[idea.id]) throw new RecordError("That idea was already handled.");
      const tx = await d.readTx(p.signature, w);
      if (!tx) throw new RecordError("Transaction not found yet. Try again in a few seconds.", 409);
      if (!tx.ok || tx.feePayer !== w) throw new RecordError("That transaction failed or was not paid by this wallet.");
      if (tx.blockTime !== null && now - tx.blockTime > 3600) throw new RecordError("Only a swap from the last hour can be recorded.");
      if (tx.blockTime !== null && tx.blockTime < idea.at) throw new RecordError("That swap happened before the idea was posted.");
      const lane = LANES[idea.lane];
      const dUsdc = tx.deltas[USDC.mint] ?? 0n;
      const dAsset = tx.deltas[lane.mint] ?? 0n;
      const right = idea.sell ? dAsset < 0n && dUsdc > 0n : dAsset > 0n && dUsdc < 0n;
      if (!right) throw new RecordError(`That transaction is not a ${idea.sell ? "sale" : "purchase"} of ${lane.symbol} for USDC.`);
      if (!(await store.setNx(`fill-sig:${p.signature}`, w, 30 * DAY))) throw new RecordError("That transaction is already recorded.");
      const abs = (x: bigint) => (x < 0n ? -x : x);
      const fill: Fill = { signal: idea.id, lane: idea.lane, sell: idea.sell, usdc: Number(abs(dUsdc)) / 10 ** USDC.decimals, qty: Number(abs(dAsset)) / 10 ** lane.decimals, signature: p.signature, at: now };
      await store.pushCapped(`fills:${w}`, JSON.stringify(fill), MAX_FILLS);
      await markHandled(store, w, idea.id, "copied");
      return `Recorded: ${idea.sell ? "sold" : "bought"} ${fill.qty.toFixed(6)} ${lane.symbol} for ${fill.usdc.toFixed(2)} USDC.`;
    }
    case "open-poll": {
      if (!d.tokenLive) throw new RecordError("Polls open once $OSCRA is live.", 409);
      const title = typeof p.title === "string" ? p.title.trim() : "";
      const choices = Array.isArray(p.choices) ? p.choices.map((c) => (typeof c === "string" ? c.trim() : "")) : [];
      if (!title || title.length > 200 || choices.length < 2 || choices.length > 6 || choices.some((c) => !c || c.length > 64)) throw new RecordError("Title up to 200 characters, 2 to 6 choices up to 64 each.");
      if (!int(p.days, 1, 14)) throw new RecordError("A poll runs 1 to 14 days.");
      const bal = await d.tokenBalance(w);
      const min = BigInt(PRACTICE_TERMS.proposerMin) * 10n ** BigInt(d.tokenDecimals);
      if (bal === null || bal < min) throw new RecordError(`Opening a poll needs ${PRACTICE_TERMS.proposerMin.toLocaleString("en-US")} $OSCRA in this wallet.`);
      const end = now + (p.days as number) * DAY;
      if (!(await store.setNx(`poll-busy:${w}`, "1", (p.days as number) * DAY))) throw new RecordError("You already have an open poll.");
      const id = await store.incr("poll-seq");
      const poll: Omit<Poll, "tally" | "voters"> = { id, author: w, title, choices, start: now, end };
      await store.pushCapped("polls", JSON.stringify(poll), MAX_POLLS);
      return `Poll #${id} opened until ${new Date(end * 1000).toUTCString()}.`;
    }
    case "vote": {
      if (!d.tokenLive) throw new RecordError("Votes open once $OSCRA is live.", 409);
      const polls = (await store.range("polls", MAX_POLLS)).map((x) => parse<Poll | null>(x, null)).filter(Boolean) as Poll[];
      const poll = polls.find((x) => x.id === p.poll);
      if (!poll) throw new RecordError("Unknown poll.");
      if (now >= poll.end) throw new RecordError("This poll is closed.");
      if (!int(p.choice, 0, poll.choices.length - 1)) throw new RecordError("Unknown choice.");
      const bal = await d.tokenBalance(w);
      if (bal === null || bal <= 0n) throw new RecordError("Voting needs $OSCRA in this wallet; the vote weighs the balance right now.");
      const weight = Number(bal / 10n ** BigInt(Math.max(0, d.tokenDecimals - 2))) / 100;
      if (!(await store.setNx(`vote:${poll.id}:${w}`, String(p.choice), Math.max(60, poll.end - now + 30 * DAY)))) throw new RecordError("This wallet already voted in this poll.");
      await store.incrBy(`tally:${poll.id}:${p.choice}`, Math.round(weight * 100));
      await store.incr(`voters:${poll.id}`);
      return `Vote counted with ${weight.toLocaleString("en-US")} $OSCRA.`;
    }
  }
  throw new RecordError("Unknown action.");
}

async function markHandled(store: Store, w: string, id: number, how: "copied" | "skipped") {
  const handled = parse<Record<string, "copied" | "skipped">>(await store.get(`handled:${w}`), {});
  if (handled[id]) throw new RecordError("That idea was already handled.");
  handled[id] = how;
  const keys = Object.keys(handled).map(Number).sort((a, b) => b - a).slice(0, MAX_HANDLED);
  await store.set(`handled:${w}`, JSON.stringify(Object.fromEntries(keys.map((k) => [k, handled[k]]))));
}

export async function readBoard(store: Store, wallet: string | null, opts: { configured: boolean; tokenLive: boolean }): Promise<Board> {
  const ideas = (await store.range("ideas", 120)).map((x) => parse<Idea | null>(x, null)).filter(Boolean) as Idea[];
  const raw = (await store.range("polls", MAX_POLLS)).map((x) => parse<Poll | null>(x, null)).filter(Boolean) as Poll[];
  const tallyKeys = raw.flatMap((p) => p.choices.map((_, i) => `tally:${p.id}:${i}`));
  const tallies = await store.mget(tallyKeys);
  const voters = await store.mget(raw.map((p) => `voters:${p.id}`));
  let k = 0;
  const polls = raw.map((p, i) => ({ ...p, tally: p.choices.map(() => Number(tallies[k++] ?? 0) / 100), voters: Number(voters[i] ?? 0) }));
  let mine: Board["mine"] = null;
  if (wallet && BASE58.test(wallet)) {
    const votes = await store.mget(polls.map((p) => `vote:${p.id}:${wallet}`));
    mine = {
      follows: parse<FollowRecord[]>(await store.get(`follows:${wallet}`), []),
      handled: parse<Record<number, "copied" | "skipped">>(await store.get(`handled:${wallet}`), {}),
      fills: (await store.range(`fills:${wallet}`, MAX_FILLS)).map((x) => parse<Fill | null>(x, null)).filter(Boolean) as Fill[],
      votes: Object.fromEntries(polls.flatMap((p, i) => (votes[i] === null ? [] : [[p.id, Number(votes[i])]]))),
    };
  }
  return { configured: opts.configured, tokenLive: opts.tokenLive, ideas, polls, mine };
}
