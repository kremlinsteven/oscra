/*
 * Practice mode: OSCRA's plan and copy rules in TypeScript, run against live Solana prices (Pyth / Jupiter) on a
 * simulated wallet kept in this browser. It adds what real Jupiter orders do not have (drawdown guard, target
 * pause, per-desk position caps) so the rules can be tried before money is used. Fills happen at the live price
 * minus a flat route cost (0.1% for SOL, 0.3% for xStocks); real swaps also pay price impact. Nothing is sent.
 */
import { LANES, LIMITS, PRACTICE_TERMS } from "@/config/lanes";

export const PRACTICE_DESK = "practice-desk";
const BPS = 10_000;
const DAY = 86_400;

export type PlanState = "active" | "held" | "guarded" | "targeted" | "spent" | "closed";

export type PlanTerms = {
  lane: number;
  perBuy: number;
  interval: number;
  budget: number;
  ceiling: number;
  slipBps: number;
  guardBps: number;
  targetBps: number;
  startAt?: number;
};

export type Plan = PlanTerms & { id: number; state: PlanState; nextAt: number; spent: number; netIn: number; bought: number; buys: number };

export type FollowTerms = {
  perSignal: number;
  dayCap: number;
  maxCost: number;
  laneMask: number;
  reviewDelay: number;
  slipBps: number;
  chaseBps: number;
  stopBps: number;
};

export type Follow = FollowTerms & { active: boolean; since: number; dayStart: number; daySpent: number };
export type Signal = { id: number; leader: string; lane: number; sell: boolean; weightBps: number; at: number; price: number };
export type Holding = { qty: number; cost: number };
export type Activity = { at: number; text: string };

export type Book = {
  v: 1;
  /** Seconds added to the real clock by the practice time buttons. */
  skew: number;
  dollars: number;
  assets: Record<number, number>;
  plans: Plan[];
  follows: Record<string, Follow>;
  holdings: Record<string, Record<number, Holding>>;
  signals: Signal[];
  handled: Record<number, "copied" | "skipped">;
  activity: Activity[];
  /** Practice $OSCRA staking: no token moves, the fee pool is filled by this book's own practice fees. */
  stake: { wallet: number; staked: number; pool: number; claimed: number };
};

export const START_DOLLARS = 10_000;

export function freshBook(): Book {
  return { v: 1, skew: 0, dollars: START_DOLLARS, assets: {}, plans: [], follows: {}, holdings: {}, signals: [], handled: {}, activity: [], stake: { wallet: 100_000, staked: 0, pool: 0, claimed: 0 } };
}

/** A rule refusal with a stable name (explained in RULE_WORDS). */
export class RuleError extends Error {
  constructor(readonly rule: string) {
    super(rule);
  }
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const minSpend = LIMITS.minSpend;

function checkPlan(t: PlanTerms, now: number) {
  if (!LANES.some((l) => l.id === t.lane)) throw new RuleError("BadLane");
  if (!(t.perBuy >= minSpend) || !(t.budget >= t.perBuy)) throw new RuleError("BadTerms");
  if (t.interval < LIMITS.minIntervalH * 3600 || t.interval > LIMITS.maxIntervalD * DAY) throw new RuleError("BadTerms");
  if (t.slipBps < LIMITS.minSlipBps || t.slipBps > LIMITS.maxSlipBps) throw new RuleError("BadTerms");
  if (t.guardBps < 0 || t.guardBps > LIMITS.maxGuardBps || t.targetBps < 0 || t.targetBps > LIMITS.maxTargetBps) throw new RuleError("BadTerms");
  if (t.ceiling < 0) throw new RuleError("BadTerms");
  if ((t.startAt ?? 0) > now + LIMITS.maxIntervalD * DAY) throw new RuleError("BadTerms");
}

export function openPlan(b: Book, t: PlanTerms, now: number): Plan {
  checkPlan(t, now);
  const p: Plan = { ...t, id: b.plans.length, state: "active", nextAt: Math.max(now, t.startAt ?? 0), spent: 0, netIn: 0, bought: 0, buys: 0 };
  b.plans.push(p);
  log(b, now, `Opened plan #${p.id}: ${p.perBuy} USDC of ${LANES[p.lane].symbol} every ${Math.round(p.interval / 3600)} h, budget ${p.budget}.`);
  return p;
}

export function setPlanState(b: Book, id: number, to: "held" | "active" | "closed", now: number) {
  const p = b.plans[id];
  if (!p) throw new RuleError("NotOwner");
  if (to === "held" && p.state !== "active") throw new RuleError("NotActive");
  if (to === "active" && !["held", "guarded", "targeted"].includes(p.state)) throw new RuleError("NotActive");
  if (to === "closed" && p.state === "closed") throw new RuleError("NotActive");
  if (to === "active" && p.nextAt < now) p.nextAt = now;
  p.state = to;
  log(b, now, `Plan #${id} ${to === "held" ? "held by you" : to === "active" ? "resumed" : "closed"}.`);
}

/** Practice fee rate in basis points: lower when the book holds or stakes the holder minimum. */
export function feeRate(b: Book) {
  return b.stake.wallet + b.stake.staked >= PRACTICE_TERMS.holderMin ? PRACTICE_TERMS.holderFeeBps : PRACTICE_TERMS.feeBps;
}

function takeFee(b: Book, gross: number) {
  const fee = round6((gross * feeRate(b)) / BPS);
  b.stake.pool = round6(b.stake.pool + fee);
  return fee;
}

export function stake(b: Book, amount: number, now: number) {
  if (!(amount > 0) || amount > b.stake.wallet) throw new RuleError("BadTerms");
  b.stake.wallet -= amount;
  b.stake.staked += amount;
  log(b, now, `Staked ${amount.toLocaleString("en-US")} practice $OSCRA.`);
}

export function unstake(b: Book, amount: number, now: number) {
  if (!(amount > 0) || amount > b.stake.staked) throw new RuleError("BadTerms");
  b.stake.staked -= amount;
  b.stake.wallet += amount;
  log(b, now, `Unstaked ${amount.toLocaleString("en-US")} practice $OSCRA.`);
}

/** In practice this book is the only staker, so a staker claims the whole pool of its own fees. */
export function claim(b: Book, now: number) {
  if (b.stake.staked <= 0) throw new RuleError("NothingStaked");
  const amount = b.stake.pool;
  if (!(amount > 0)) throw new RuleError("NothingToClaim");
  b.stake.pool = 0;
  b.stake.claimed = round6(b.stake.claimed + amount);
  b.dollars = round6(b.dollars + amount);
  log(b, now, `Claimed ${amount} practice USDC of fee share.`);
}

export const averageEntry = (p: { netIn: number; bought: number }) => (p.bought > 0 ? p.netIn / p.bought : 0);

/** Flat route cost of a practice fill against the live price. */
const poolCost = (lane: number) => (LANES[lane].kind === "crypto" ? 0.001 : 0.003);

export type Outcome = "filled" | "guarded" | "targeted" | "stopped";

/** Runs a due practice buy. `price` is the lane's live price in dollars. */
export function runPlan(b: Book, id: number, price: number, now: number): Outcome {
  const p = b.plans[id];
  if (!p || p.state !== "active") throw new RuleError("NotActive");
  if (now < p.nextAt) throw new RuleError("NotDue");
  if (!(price > 0)) throw new RuleError("StalePrice");
  if (p.ceiling !== 0 && price > p.ceiling) throw new RuleError("AboveCeiling");
  if (p.bought !== 0) {
    const avg = averageEntry(p);
    if (p.guardBps !== 0 && price * BPS < avg * (BPS - p.guardBps)) {
      p.state = "guarded";
      log(b, now, `Plan #${id} paused by its drawdown guard at $${price.toFixed(2)} (average $${avg.toFixed(2)}).`);
      return "guarded";
    }
    if (p.targetBps !== 0 && price * BPS >= avg * (BPS + p.targetBps)) {
      p.state = "targeted";
      log(b, now, `Plan #${id} reached its target at $${price.toFixed(2)} (average $${avg.toFixed(2)}).`);
      return "targeted";
    }
  }
  let gross = Math.min(p.perBuy, round6(p.budget - p.spent));
  if (gross < minSpend) throw new RuleError("AmountTooSmall");
  if (b.dollars < gross) throw new RuleError("NotEnoughDollars");
  gross = round6(gross);
  const fee = takeFee(b, gross);
  const out = ((gross - fee) / price) * (1 - poolCost(p.lane));
  b.dollars = round6(b.dollars - gross);
  b.assets[p.lane] = (b.assets[p.lane] ?? 0) + out;
  p.spent = round6(p.spent + gross);
  p.netIn = round6(p.netIn + gross);
  p.bought += out;
  p.buys += 1;
  p.nextAt = now + p.interval;
  log(b, now, `Plan #${id} bought ${out.toFixed(6)} ${LANES[p.lane].symbol} for ${gross} USDC at $${price.toFixed(2)}.`);
  if (p.budget - p.spent < minSpend) p.state = "spent";
  return "filled";
}

export function follow(b: Book, leader: string, t: FollowTerms, now: number) {
  if (!leader) throw new RuleError("BadTerms");
  if (!(t.perSignal >= minSpend) || !(t.dayCap >= t.perSignal)) throw new RuleError("BadTerms");
  if (t.laneMask <= 0 || t.laneMask >> LANES.length !== 0) throw new RuleError("BadTerms");
  if (t.reviewDelay < 0 || t.reviewDelay > LIMITS.maxReviewDelayH * 3600) throw new RuleError("BadTerms");
  if (t.slipBps < LIMITS.minSlipBps || t.slipBps > LIMITS.maxSlipBps) throw new RuleError("BadTerms");
  if (t.chaseBps < 0 || t.chaseBps > LIMITS.maxChaseBps || t.stopBps < 0 || t.stopBps > LIMITS.maxGuardBps) throw new RuleError("BadTerms");
  if (t.maxCost !== 0 && t.maxCost < t.perSignal) throw new RuleError("BadTerms");
  const prev = b.follows[leader];
  b.follows[leader] = { ...t, active: true, since: prev?.active ? prev.since : now, dayStart: prev?.dayStart ?? 0, daySpent: prev?.daySpent ?? 0 };
  log(b, now, `Following ${leader === PRACTICE_DESK ? "the practice desk" : leader}: ${t.perSignal} USDC per idea, ${t.dayCap} a day.`);
}

export function unfollow(b: Book, leader: string, now: number) {
  const f = b.follows[leader];
  if (!f?.active) throw new RuleError("NotFollowing");
  f.active = false;
  log(b, now, `Stopped following ${leader === PRACTICE_DESK ? "the practice desk" : leader}.`);
}

export function post(b: Book, leader: string, lane: number, sell: boolean, weightBps: number, price: number, now: number): Signal {
  if (!LANES.some((l) => l.id === lane)) throw new RuleError("BadLane");
  if (weightBps <= 0 || weightBps > BPS) throw new RuleError("BadTerms");
  if (!(price > 0)) throw new RuleError("StalePrice");
  const s: Signal = { id: b.signals.length, leader, lane, sell, weightBps, at: now, price };
  b.signals.push(s);
  log(b, now, `Idea #${s.id}: ${sell ? "sell" : "buy"} ${LANES[lane].symbol} at weight ${weightBps / 100}% (price $${price.toFixed(2)}).`);
  return s;
}

export function skip(b: Book, id: number, now: number) {
  if (!b.signals[id]) throw new RuleError("UnknownSignal");
  if (b.handled[id]) throw new RuleError("AlreadyHandled");
  b.handled[id] = "skipped";
  log(b, now, `Skipped idea #${id}.`);
}

/** When an idea can be copied: [opens, closes] in seconds. */
export function copyWindow(s: Signal, f: Follow) {
  const opens = s.at + f.reviewDelay;
  return [opens, opens + LIMITS.mirrorWindowH * 3600] as const;
}

/** Copies one practice idea into this book, inside the follow's limits. */
export function mirror(b: Book, id: number, price: number, now: number): Outcome {
  const s = b.signals[id];
  if (!s) throw new RuleError("UnknownSignal");
  const f = b.follows[s.leader];
  if (!f?.active || s.at < f.since) throw new RuleError("NotFollowing");
  if ((f.laneMask & (1 << s.lane)) === 0) throw new RuleError("NotFollowing");
  if (b.handled[id]) throw new RuleError("AlreadyHandled");
  const [opens, closes] = copyWindow(s, f);
  if (now < opens || now > closes) throw new RuleError("OutsideWindow");
  if (!(price > 0)) throw new RuleError("StalePrice");
  const book = (b.holdings[s.leader] ??= {});
  const h = (book[s.lane] ??= { qty: 0, cost: 0 });
  if (s.sell) {
    if (price * BPS < s.price * (BPS - f.chaseBps)) throw new RuleError("PriceMoved");
    let qty = (h.qty * s.weightBps) / BPS;
    qty = Math.min(qty, b.assets[s.lane] ?? 0);
    if (!(qty > 0)) throw new RuleError("NothingToSell");
    b.handled[id] = "copied";
    const costOff = (h.cost * qty) / h.qty;
    h.qty -= qty;
    h.cost = round6(h.cost - costOff);
    const out = round6(qty * price * (1 - poolCost(s.lane)));
    b.assets[s.lane] = (b.assets[s.lane] ?? 0) - qty;
    b.dollars = round6(b.dollars + out);
    log(b, now, `Copied idea #${id}: sold ${qty.toFixed(6)} ${LANES[s.lane].symbol} for ${out} USDC.`);
    return "filled";
  }
  if (price * BPS > s.price * (BPS + f.chaseBps)) throw new RuleError("PriceMoved");
  b.handled[id] = "copied";
  if (f.stopBps !== 0 && h.qty !== 0 && h.qty * price * BPS < h.cost * (BPS - f.stopBps)) {
    f.active = false;
    log(b, now, `Follow stopped: the copied ${LANES[s.lane].symbol} position fell past your ${f.stopBps / 100}% stop.`);
    return "stopped";
  }
  const gross = round6((f.perSignal * s.weightBps) / BPS);
  if (gross < minSpend) throw new RuleError("AmountTooSmall");
  if (now >= f.dayStart + DAY) {
    f.dayStart = now;
    f.daySpent = 0;
  }
  if (f.daySpent + gross > f.dayCap) {
    delete b.handled[id];
    throw new RuleError("DayCapReached");
  }
  if (f.maxCost !== 0 && h.cost + gross > f.maxCost) {
    delete b.handled[id];
    throw new RuleError("PositionCapReached");
  }
  if (b.dollars < gross) {
    delete b.handled[id];
    throw new RuleError("NotEnoughDollars");
  }
  f.daySpent = round6(f.daySpent + gross);
  const fee = takeFee(b, gross);
  const out = ((gross - fee) / price) * (1 - poolCost(s.lane));
  b.dollars = round6(b.dollars - gross);
  b.assets[s.lane] = (b.assets[s.lane] ?? 0) + out;
  h.qty += out;
  h.cost = round6(h.cost + gross);
  log(b, now, `Copied idea #${id}: bought ${out.toFixed(6)} ${LANES[s.lane].symbol} for ${gross} USDC.`);
  return "filled";
}

function log(b: Book, at: number, text: string) {
  b.activity.unshift({ at, text });
  if (b.activity.length > 60) b.activity.length = 60;
}

/** Validates a book read back from storage; anything unexpected starts fresh. */
export function checkBook(v: unknown): Book | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Book;
  if (b.v !== 1 || typeof b.dollars !== "number" || !Array.isArray(b.plans) || !Array.isArray(b.signals) || typeof b.follows !== "object" || typeof b.skew !== "number") return null;
  if (!b.plans.every((p) => typeof p?.id === "number" && typeof p.lane === "number" && typeof p.spent === "number")) return null;
  const stakeOk = b.stake && typeof b.stake.wallet === "number" && typeof b.stake.staked === "number";
  return { ...freshBook(), ...b, stake: stakeOk ? b.stake : freshBook().stake, activity: Array.isArray(b.activity) ? b.activity.slice(0, 60) : [] };
}

/** Deep copy of a book (plain JSON data). */
export function copyBook(b: Book): Book {
  return JSON.parse(JSON.stringify(b)) as Book;
}

/** Plain words for each rule name. */
export const RULE_WORDS: Record<string, string> = {
  BadLane: "unknown market.",
  BadTerms: "a limit is outside the allowed range.",
  NotOwner: "not your plan.",
  NotActive: "the plan is not in a state that allows this.",
  NotDue: "the next buy is not due yet.",
  StalePrice: "no live price for this market right now.",
  AboveCeiling: "the price is above your ceiling, so the buy waits.",
  AmountTooSmall: "the amount is below the minimum.",
  NotEnoughDollars: "not enough practice USDC.",
  NotFollowing: "you do not follow this desk on this market (or the idea predates the follow).",
  UnknownSignal: "unknown idea.",
  AlreadyHandled: "this idea was already copied or skipped.",
  OutsideWindow: "outside the copy window (review delay, then 6 hours).",
  PriceMoved: "the price moved past your chase limit.",
  DayCapReached: "your daily cap for this desk is used up.",
  PositionCapReached: "your position cap for this desk is reached.",
  NothingToSell: "nothing copied from this desk to sell.",
  NothingStaked: "stake some practice $OSCRA first.",
  NothingToClaim: "no practice fees in the pool yet. Run a practice buy first.",
};
