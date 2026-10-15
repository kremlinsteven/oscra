import { test } from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_DESK, RuleError, follow, freshBook, mirror, openPlan, post, runPlan, setPlanState, skip, type FollowTerms, type PlanTerms } from "./practice";
import { buildReview, rsi, sizeFromStop } from "./review";

const T0 = 1_800_000_000;
const plan = (o: Partial<PlanTerms> = {}): PlanTerms => ({ lane: 0, perBuy: 100, interval: 86_400, budget: 300, ceiling: 0, slipBps: 100, guardBps: 0, targetBps: 0, tip: 0, ...o });
const terms = (o: Partial<FollowTerms> = {}): FollowTerms => ({ perSignal: 100, dayCap: 300, maxCost: 0, laneMask: 3, reviewDelay: 3600, slipBps: 100, chaseBps: 200, stopBps: 0, tip: 0, ...o });
const rule = (fn: () => unknown, name: string) => assert.throws(fn, (e) => e instanceof RuleError && e.rule === name);

test("a plan buys on schedule and stops at its budget", () => {
  const b = freshBook();
  openPlan(b, plan({ budget: 250 }), T0);
  assert.equal(runPlan(b, 0, 2000, T0), "filled");
  rule(() => runPlan(b, 0, 2000, T0 + 10), "NotDue");
  runPlan(b, 0, 2000, T0 + 86_400);
  runPlan(b, 0, 2000, T0 + 2 * 86_400);
  assert.equal(b.plans[0].spent, 250);
  assert.equal(b.plans[0].state, "spent");
  assert.equal(b.dollars, 10_000 - 250);
});

test("ceiling, guard and target behave like the contract", () => {
  const b = freshBook();
  openPlan(b, plan({ ceiling: 1900, guardBps: 1500, targetBps: 2500, budget: 1000 }), T0);
  rule(() => runPlan(b, 0, 2000, T0), "AboveCeiling");
  runPlan(b, 0, 1800, T0);
  assert.equal(runPlan(b, 0, 1400, T0 + 86_400), "guarded");
  setPlanState(b, 0, "active", T0 + 86_400);
  b.plans[0].ceiling = 0;
  assert.equal(runPlan(b, 0, 2400, T0 + 2 * 86_400), "targeted");
});

test("terms outside the contract's limits are refused", () => {
  const b = freshBook();
  rule(() => openPlan(b, plan({ interval: 600 }), T0), "BadTerms");
  rule(() => openPlan(b, plan({ slipBps: 10 }), T0), "BadTerms");
  rule(() => openPlan(b, plan({ tip: 50 }), T0), "BadTerms");
  rule(() => openPlan(b, plan({ lane: 42 }), T0), "BadLane");
});

test("copied ideas wait for the review delay, respect skips, caps and the chase limit", () => {
  const b = freshBook();
  follow(b, PRACTICE_DESK, terms({ dayCap: 150 }), T0);
  const a = post(b, PRACTICE_DESK, 1, false, 10_000, 200, T0 + 1);
  rule(() => mirror(b, a.id, 200, T0 + 2), "OutsideWindow");
  assert.equal(mirror(b, a.id, 201, T0 + 3601), "filled");
  rule(() => mirror(b, a.id, 201, T0 + 3602), "AlreadyHandled");
  const c = post(b, PRACTICE_DESK, 1, false, 10_000, 200, T0 + 3602);
  rule(() => mirror(b, c.id, 200, T0 + 7300), "DayCapReached");
  const d = post(b, PRACTICE_DESK, 1, false, 5_000, 200, T0 + 3700);
  rule(() => mirror(b, d.id, 210, T0 + 7400), "PriceMoved");
  const e = post(b, PRACTICE_DESK, 1, false, 5_000, 200, T0 + 3800);
  skip(b, e.id, T0 + 3801);
  rule(() => mirror(b, e.id, 200, T0 + 7500), "AlreadyHandled");
});

test("a sell copies the same share of the copied position", () => {
  const b = freshBook();
  follow(b, PRACTICE_DESK, terms({ reviewDelay: 0 }), T0);
  const a = post(b, PRACTICE_DESK, 1, false, 10_000, 200, T0 + 1);
  mirror(b, a.id, 200, T0 + 1);
  const qty = b.holdings[PRACTICE_DESK][1].qty;
  const s = post(b, PRACTICE_DESK, 1, true, 5_000, 220, T0 + 2);
  mirror(b, s.id, 220, T0 + 2);
  assert.ok(Math.abs(b.holdings[PRACTICE_DESK][1].qty - qty / 2) < 1e-12);
  assert.equal(b.holdings[PRACTICE_DESK][1].cost, 50);
});

test("review rules and sizing", () => {
  const rising = Array.from({ length: 80 }, (_, i) => ({ t: i, close: 100 + i * 0.5 + (i % 3) }));
  const r = buildReview(0, "test", rising, "candle");
  assert.ok(r);
  assert.equal(r!.bias, "up");
  assert.equal(r!.checks.length, 5);
  assert.ok(r!.invalidation < r!.last);
  assert.ok(rsi(rising.map((p) => p.close)) > 50);
  assert.equal(buildReview(0, "test", rising.slice(0, 10), "candle"), null);
  const s = sizeFromStop(10_000, 1, 0.025);
  assert.ok(s && Math.abs(s.size - 4000) < 1e-9 && s.risk === 100);
  assert.equal(sizeFromStop(10_000, 1, 0), null);
});
