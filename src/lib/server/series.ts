import "server-only";
import { laneById, type Lane } from "@/config/lanes";
import { readCappedResponse } from "@/lib/server/capped";
import type { Point } from "@/lib/review";

/*
 * Price history for the review, all from free public sources without keys:
 *   SOL     OKX 4-hour candles (SOL-USDT), newest first in the answer, so reversed; pool candles as fallback.
 *   xStocks 4-hour candles of the token's deepest USDC pool on Solana, from GeckoTerminal.
 */

export type Series = { points: Point[]; source: string; unit: string };

async function okxCandles(): Promise<Point[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch("https://www.okx.com/api/v5/market/candles?instId=SOL-USDT&bar=4H&limit=150", { cache: "no-store", signal: ctrl.signal, headers: { accept: "application/json" } });
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

async function getJson<T>(url: string, limit = 400_000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok || !res.body) return null;
    const text = await readCappedResponse(res, limit);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Deepest USDC pool of a mint on GeckoTerminal, remembered per server instance. */
const poolOf = new Map<string, string>();
async function deepestPool(lane: Lane): Promise<string | null> {
  const known = poolOf.get(lane.mint);
  if (known) return known;
  const body = await getJson<{ data?: { attributes: { address: string; name: string; reserve_in_usd: string } }[] }>(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${lane.mint}/pools?page=1`);
  const pools = (body?.data ?? []).filter((p) => /\/\s*USDC$/i.test(p.attributes.name)).sort((a, b) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd));
  const best = pools[0]?.attributes.address ?? null;
  if (best) poolOf.set(lane.mint, best);
  return best;
}

/** 4-hour candles of the lane's deepest USDC pool (GeckoTerminal, free, no key), oldest first. */
async function poolCandles(lane: Lane): Promise<Point[] | null> {
  const pool = await deepestPool(lane);
  if (!pool) return null;
  const body = await getJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/hour?aggregate=4&limit=150&currency=usd&token=base`);
  const rows = body?.data?.attributes?.ohlcv_list ?? [];
  const pts = rows
    .map((r) => ({ t: Number(r[0]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .sort((x, y) => x.t - y.t);
  return pts.length >= 30 ? pts : null;
}

export async function readSeries(laneId: number): Promise<Series | null> {
  const lane = laneById(laneId);
  if (!lane) return null;
  if (lane.symbol === "SOL") {
    const okx = await okxCandles();
    if (okx) return { points: okx, source: "OKX SOL-USDT 4-hour candles", unit: "candle" };
  }
  const pool = await poolCandles(lane);
  return pool ? { points: pool, source: `${lane.symbol} / USDC pool 4-hour candles on Solana (GeckoTerminal)`, unit: "candle" } : null;
}
