import "server-only";
import { decodeFunctionResult, encodeFunctionData, type Abi } from "viem";
import { laneById, type Lane } from "@/config/lanes";
import { FEED_ABI } from "@/lib/abi";
import { rpcBatch } from "@/lib/feeds/rpc";
import { readCappedResponse } from "@/lib/server/capped";
import type { Point } from "@/lib/review";

/*
 * Price history for the review, all from free public sources without keys:
 *   ETH     OKX 4-hour candles (ETH-USDT), newest first in the answer, so reversed; Chainlink rounds as fallback.
 *   Stocks  the Chainlink feed's own rounds, read on-chain (a new round on every 0.5% move or once a day).
 */

export type Series = { points: Point[]; source: string; unit: string };

async function okxCandles(): Promise<Point[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch("https://www.okx.com/api/v5/market/candles?instId=ETH-USDT&bar=4H&limit=150", { cache: "no-store", signal: ctrl.signal, headers: { accept: "application/json" } });
      if (!res.ok || !res.body) continue;
      const text = await readCappedResponse(res, 200_000);
      if (!text) return null;
      const body = JSON.parse(text) as { code?: string; data?: string[][] };
      if (body.code !== "0" || !Array.isArray(body.data)) continue;
      const pts = body.data
        .map((r) => ({ t: Math.floor(Number(r[0]) / 1000), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]) }))
        .filter((p) => Number.isFinite(p.close) && p.close > 0)
        .reverse();
      return pts.length >= 30 ? pts : null;
    } catch {
      // network flake: try again
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** The last `count` rounds of a Chainlink feed, oldest first. Stays inside the current phase. */
async function feedRounds(lane: Lane, count = 120): Promise<Point[] | null> {
  const abi = FEED_ABI as Abi;
  const latestCall = { method: "eth_call", params: [{ to: lane.feed, data: encodeFunctionData({ abi, functionName: "latestRoundData" }) }, "latest"] };
  const [raw] = await rpcBatch<string>([latestCall]).catch(() => [null]);
  if (typeof raw !== "string") return null;
  const latest = decodeFunctionResult({ abi, functionName: "latestRoundData", data: raw as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint];
  const id = latest[0];
  const phase = id >> 64n;
  const agg = id & ((1n << 64n) - 1n);
  const ids: bigint[] = [];
  for (let k = BigInt(count - 1); k >= 1n; k--) if (agg > k) ids.push((phase << 64n) | (agg - k));
  const points: Point[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const answers = await rpcBatch<string>(chunk.map((r) => ({ method: "eth_call", params: [{ to: lane.feed, data: encodeFunctionData({ abi, functionName: "getRoundData", args: [r] }) }, "latest"] }))).catch(() => chunk.map(() => null));
    answers.forEach((a) => {
      if (typeof a !== "string" || a.length < 10) return;
      try {
        const v = decodeFunctionResult({ abi, functionName: "getRoundData", data: a as `0x${string}` }) as readonly [bigint, bigint, bigint, bigint, bigint];
        if (v[1] > 0n && v[3] > 0n) points.push({ t: Number(v[3]), close: Number(v[1]) / 1e8 });
      } catch {
        // skip a round that does not decode
      }
    });
  }
  if (latest[1] > 0n) points.push({ t: Number(latest[3]), close: Number(latest[1]) / 1e8 });
  points.sort((a, b) => a.t - b.t);
  return points.length >= 30 ? points : null;
}

export async function readSeries(laneId: number): Promise<Series | null> {
  const lane = laneById(laneId);
  if (!lane) return null;
  if (lane.symbol === "ETH") {
    const okx = await okxCandles();
    if (okx) return { points: okx, source: "OKX ETH-USDT 4-hour candles", unit: "candle" };
  }
  const rounds = await feedRounds(lane);
  return rounds ? { points: rounds, source: `Chainlink ${lane.symbol} / USD rounds on Robinhood Chain`, unit: "update" } : null;
}
