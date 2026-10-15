import { test } from "node:test";
import assert from "node:assert/strict";
import { holdingOf, planCopy } from "./copy-rules";
import type { Fill, FollowRecord, Idea } from "./records-shared";

const L = "Leader1111111111111111111111111111111111111";
const T = 1_800_000_000;
const follow: FollowRecord = { leader: L, since: T, perSignal: 100, dayCap: 150, maxCost: 400, laneMask: 3, reviewDelay: 3600, slipBps: 100, chaseBps: 200, stopBps: 2000 };
const idea = (o: Partial<Idea> = {}): Idea => ({ id: 1, leader: L, lane: 1, sell: false, weightBps: 10_000, at: T + 10, price: 200, ...o });
const base = { follow, handled: undefined, fills: [] as Fill[], ideas: [idea()], price: 200, walletQty: 0, now: T + 3700 };

test("a buy inside every limit spends per-idea x weight", () => {
  assert.deepEqual(planCopy({ ...base, idea: idea() }), { ok: true, side: "buy", usdc: 100 });
  assert.deepEqual(planCopy({ ...base, idea: idea({ weightBps: 2500 }) }), { ok: true, side: "buy", usdc: 25 });
});

test("review delay, window, chase, lanes, handled and pre-follow ideas are refused", () => {
  assert.equal(planCopy({ ...base, idea: idea(), now: T + 100 }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea(), now: T + 3610 + 6 * 3600 + 1 }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea(), price: 205 }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea({ lane: 5 }) }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea(), handled: "skipped" }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea({ at: T - 1 }) }).ok, false);
  assert.equal(planCopy({ ...base, idea: idea(), follow: undefined }).ok, false);
});

test("daily cap, position cap and stop use recorded fills", () => {
  const fills: Fill[] = [{ signal: 1, lane: 1, sell: false, usdc: 100, qty: 0.5, signature: "s", at: T + 3700 }];
  const second = idea({ id: 2 });
  const ideas = [idea(), second];
  assert.match((planCopy({ ...base, ideas, fills, idea: second }) as { reason: string }).reason, /Daily cap/);
  const old = fills.map((f) => ({ ...f, at: T - 90_000 }));
  assert.equal(planCopy({ ...base, ideas, fills: old, idea: second, follow: { ...follow, maxCost: 150 } }).ok, false);
  const crash = planCopy({ ...base, ideas, fills: old, idea: second, follow: { ...follow, maxCost: 0 }, price: 150 });
  assert.equal(crash.ok, false);
});

test("a sell copies the weight share of what this desk's copies hold, capped by the wallet", () => {
  const fills: Fill[] = [{ signal: 1, lane: 1, sell: false, usdc: 100, qty: 0.5, signature: "s", at: T }];
  const sell = idea({ id: 3, sell: true, weightBps: 5000 });
  const plan = planCopy({ ...base, ideas: [idea(), sell], fills, idea: sell, walletQty: 10 });
  assert.deepEqual(plan, { ok: true, side: "sell", qty: 0.25 });
  assert.deepEqual(planCopy({ ...base, ideas: [idea(), sell], fills, idea: sell, walletQty: 0.1 }), { ok: true, side: "sell", qty: 0.1 });
  const h = holdingOf([...fills, { signal: 3, lane: 1, sell: true, usdc: 55, qty: 0.25, signature: "t", at: T + 1 }], [idea(), sell], L, 1);
  assert.ok(Math.abs(h.qty - 0.25) < 1e-12 && Math.abs(h.cost - 50) < 1e-9);
});
