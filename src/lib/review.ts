/*
 * The OSCRA trade review: fixed rules over a price series, no model. Every line of the read traces back to a
 * number that is shown next to it, so a reader can check it. Pure functions; the data comes from
 * src/lib/server/series.ts (OKX candles for SOL, Solana pool candles for xStocks).
 */

export type Point = { t: number; close: number; high?: number; low?: number };

export type Verdict = "clear" | "watch" | "against";

export type Check = { key: string; label: string; verdict: Verdict; value: string; note: string };

export type Review = {
  lane: number;
  source: string;
  points: number;
  last: number;
  lastAt: number;
  ema20: number;
  ema50: number;
  rsi: number;
  rangeHigh: number;
  rangeLow: number;
  rangePos: number;
  /** Typical move per point, as a fraction of price. */
  typicalMove: number;
  /** Lowest close of the last 20 points: where a buy idea is wrong. */
  invalidation: number;
  /** Highest close of the last 20 points: the first level overhead. */
  overhead: number;
  stopDistance: number;
  bias: "up" | "down" | "mixed";
  score: number;
  checks: Check[];
  summary: string[];
  spark: number[];
};

export function ema(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function rsi(values: number[], n = 14): number {
  if (values.length < n + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

const pct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
const money = (x: number) => `$${x.toLocaleString("en-US", { maximumFractionDigits: x >= 1000 ? 0 : 2, minimumFractionDigits: x >= 1000 ? 0 : 2 })}`;

/** Builds the read. Needs at least 30 points, oldest first. */
export function buildReview(lane: number, source: string, series: Point[], unitLabel: string): Review | null {
  if (series.length < 30) return null;
  const closes = series.map((p) => p.close);
  const last = closes[closes.length - 1];
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const ema20 = e20[e20.length - 1];
  const ema50 = e50[e50.length - 1];
  const r = rsi(closes);
  const window = closes.slice(-60);
  const rangeHigh = Math.max(...window);
  const rangeLow = Math.min(...window);
  const rangePos = rangeHigh > rangeLow ? (last - rangeLow) / (rangeHigh - rangeLow) : 0.5;
  const recent = closes.slice(-20);
  const invalidation = Math.min(...recent);
  const overhead = Math.max(...recent);
  const moves = closes.slice(-31).slice(1).map((c, i) => Math.abs(Math.log(c / closes.slice(-31)[i])));
  const typicalMove = moves.reduce((a, b) => a + b, 0) / Math.max(1, moves.length);
  const stopDistance = last > 0 ? Math.max(0, (last - invalidation) / last) : 0;

  const bias: Review["bias"] = last > ema20 && ema20 > ema50 ? "up" : last < ema20 && ema20 < ema50 ? "down" : "mixed";
  const checks: Check[] = [];
  checks.push({
    key: "trend",
    label: "Trend",
    verdict: bias === "up" ? "clear" : bias === "mixed" ? "watch" : "against",
    value: bias === "up" ? "Rising" : bias === "down" ? "Falling" : "Mixed",
    note: `Price ${pct(last / ema20 - 1)} vs its 20-${unitLabel} average; the 20 is ${pct(ema20 / ema50 - 1)} vs the 50.`,
  });
  const roomToStop = stopDistance / Math.max(typicalMove, 1e-9);
  checks.push({
    key: "level",
    label: "Invalidation",
    verdict: stopDistance === 0 ? "against" : roomToStop <= 4 ? "clear" : roomToStop <= 8 ? "watch" : "against",
    value: money(invalidation),
    note: stopDistance === 0 ? "Price sits on its 20-point low: no level under it to lean on." : `${(stopDistance * 100).toFixed(1)}% below, about ${roomToStop.toFixed(1)} typical moves away.`,
  });
  checks.push({
    key: "momentum",
    label: "Momentum",
    verdict: r >= 40 && r <= 65 ? "clear" : r > 75 || r < 25 ? "against" : "watch",
    value: `RSI ${r.toFixed(0)}`,
    note: r > 65 ? "Stretched: buys here chase strength." : r < 40 ? "Weak: sellers are still in control." : "Neither stretched nor washed out.",
  });
  checks.push({
    key: "room",
    label: "Room overhead",
    verdict: last >= overhead * 0.995 ? "watch" : "clear",
    value: money(overhead),
    note: last >= overhead * 0.995 ? "At its 20-point high: the next level is unknown." : `${pct(overhead / last - 1)} to the 20-point high.`,
  });
  checks.push({
    key: "swing",
    label: "Volatility",
    verdict: typicalMove < 0.015 ? "clear" : typicalMove < 0.035 ? "watch" : "against",
    value: `${(typicalMove * 100).toFixed(2)}% / ${unitLabel}`,
    note: typicalMove < 0.015 ? "Calm enough for a fixed schedule." : "Wide swings: smaller orders spread the risk.",
  });
  const score = checks.filter((c) => c.verdict === "clear").length;
  const summary = [
    bias === "up"
      ? `Trend is rising: price holds above the 20-${unitLabel} average, which holds above the 50.`
      : bias === "down"
        ? `Trend is falling: price trades under the 20-${unitLabel} average, which sits under the 50.`
        : `Trend is mixed: the averages disagree, so direction is not settled.`,
    stopDistance > 0
      ? `A buy idea is wrong below ${money(invalidation)}, ${(stopDistance * 100).toFixed(1)}% under the last price. Size from that distance, not from conviction.`
      : `There is no recent low under the price, so a stop has to come from your own rule.`,
    `Position in the 60-point range: ${(rangePos * 100).toFixed(0)}% of the way from ${money(rangeLow)} to ${money(rangeHigh)}.`,
    `${score} of 5 checks clear. ${score >= 4 ? "Conditions support a planned entry." : score >= 2 ? "Worth a smaller or slower entry, or waiting." : "The rules say wait."}`,
  ];
  return {
    lane,
    source,
    points: series.length,
    last,
    lastAt: series[series.length - 1].t,
    ema20,
    ema50,
    rsi: r,
    rangeHigh,
    rangeLow,
    rangePos,
    typicalMove,
    invalidation,
    overhead,
    stopDistance,
    bias,
    score,
    checks,
    summary,
    spark: closes.slice(-60),
  };
}

/** Position size in dollars so that a stop at `stopDistance` loses `riskPct` of `account`. */
export function sizeFromStop(account: number, riskPct: number, stopDistance: number) {
  if (!(account > 0) || !(riskPct > 0) || !(stopDistance > 0)) return null;
  const risk = (account * riskPct) / 100;
  return { risk, size: Math.min(account, risk / stopDistance) };
}
