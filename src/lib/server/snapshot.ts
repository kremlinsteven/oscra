import "server-only";
import { PublicKey } from "@solana/web3.js";
import { BRAND, USDC, isAddress } from "@/config/brand";
import { LANES, PYTH_FRESH_SECS, PYTH_PUSH_PROGRAM } from "@/config/lanes";
import { rpcBatch } from "@/lib/feeds/rpc";
import { readCappedResponse } from "@/lib/server/capped";

/*
 * Live facts for the whole site, all read from public Solana sources: the latest slot and its time, slot pace,
 * recent priority fees, the price of every lane (Pyth on-chain push feed when fresh, else the Jupiter price API,
 * matched by mint), USDC's supply, and the token once its mint is published. Nothing here is typed in.
 */

export type LanePrice = { id: number; price: number | null; updatedAt: number | null; source: "pyth" | "jupiter" | null };

export type ChainSnapshot = {
  at: number;
  slot: number | null;
  blockTime: number | null;
  /** Average seconds per slot over the last few minutes. */
  slotPace: number | null;
  /** Median recent priority fee, micro-lamports per compute unit. */
  priorityFee: number | null;
  prices: LanePrice[];
  usdcSupply: string | null;
  token: { name: string | null; symbol: string | null; supply: string | null; decimals: number | null; program: string | null } | null;
};

const pushAccount = (feedId: string) =>
  PublicKey.findProgramAddressSync([Buffer.from([0, 0]), Buffer.from(feedId, "hex")], new PublicKey(PYTH_PUSH_PROGRAM))[0].toBase58();

/** Decodes a Pyth PriceUpdateV2 account (verification level byte at 40; Full = 1, Partial = 0 + 1 byte). */
export function decodePriceUpdate(data: Buffer): { feedId: string; price: number; publishTime: number } | null {
  if (data.length < 134) return null;
  const m = data[40] === 1 ? 41 : data[40] === 0 ? 42 : -1;
  if (m < 0) return null;
  const feedId = data.subarray(m, m + 32).toString("hex");
  const raw = data.readBigInt64LE(m + 32);
  const expo = data.readInt32LE(m + 48);
  const publishTime = Number(data.readBigInt64LE(m + 52));
  if (raw <= 0n) return null;
  return { feedId, price: Number(raw) * 10 ** expo, publishTime };
}

type AccountValue = { data: [string, string]; owner: string } | null;

async function jupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok || !res.body) return {};
    const text = await readCappedResponse(res, 200_000);
    if (!text) return {};
    const body = JSON.parse(text) as Record<string, { usdPrice?: number } | null>;
    const out: Record<string, number> = {};
    for (const m of mints) {
      const p = body[m]?.usdPrice;
      if (typeof p === "number" && p > 0 && Number.isFinite(p)) out[m] = p;
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export async function readSnapshot(): Promise<ChainSnapshot> {
  const ca = isAddress(BRAND.ca) ? BRAND.ca : null;
  const feeds = LANES.map((l) => pushAccount(l.feedId));
  const calls: { method: string; params: unknown[] }[] = [
    { method: "getSlot", params: [{ commitment: "confirmed" }] },
    { method: "getRecentPerformanceSamples", params: [5] },
    { method: "getRecentPrioritizationFees", params: [] },
    { method: "getMultipleAccounts", params: [feeds, { encoding: "base64" }] },
    { method: "getTokenSupply", params: [USDC.mint] },
  ];
  if (ca) calls.push({ method: "getTokenSupply", params: [ca] }, { method: "getAccountInfo", params: [ca, { encoding: "jsonParsed" }] });
  const r = await rpcBatch<unknown>(calls).catch(() => calls.map(() => null));
  const slot = typeof r[0] === "number" ? r[0] : null;
  const blockTime = slot ? await rpcBatch<number>([{ method: "getBlockTime", params: [slot] }]).then((x) => x[0]).catch(() => null) : null;
  const samples = Array.isArray(r[1]) ? (r[1] as { numSlots: number; samplePeriodSecs: number }[]) : [];
  const slots = samples.reduce((a, s) => a + s.numSlots, 0);
  const secs = samples.reduce((a, s) => a + s.samplePeriodSecs, 0);
  const fees = Array.isArray(r[2]) ? (r[2] as { prioritizationFee: number }[]).map((f) => f.prioritizationFee).filter((n) => n > 0) : [];
  const accounts = ((r[3] as { value?: AccountValue[] } | null)?.value ?? []) as AccountValue[];
  const now = Math.floor(Date.now() / 1000);

  const prices: LanePrice[] = LANES.map((l, k) => {
    const a = accounts[k];
    if (a && Array.isArray(a.data)) {
      const d = decodePriceUpdate(Buffer.from(a.data[0], "base64"));
      if (d && d.feedId === l.feedId && now - d.publishTime <= PYTH_FRESH_SECS) return { id: l.id, price: d.price, updatedAt: d.publishTime, source: "pyth" };
    }
    return { id: l.id, price: null, updatedAt: null, source: null };
  });
  const missing = prices.filter((p) => p.price === null).map((p) => LANES[p.id].mint);
  const jup = await jupiterPrices(missing);
  for (const p of prices) {
    const v = jup[LANES[p.id].mint];
    if (p.price === null && v) Object.assign(p, { price: v, updatedAt: now, source: "jupiter" });
  }

  const usdc = (r[4] as { value?: { amount: string } } | null)?.value?.amount ?? null;
  let token: ChainSnapshot["token"] = null;
  if (ca) {
    const sup = (r[5] as { value?: { amount: string; decimals: number } } | null)?.value;
    const acct = (r[6] as { value?: { owner: string; data?: { parsed?: { info?: { extensions?: { extension: string; state?: { name?: string; symbol?: string } }[] } } } } } | null)?.value;
    const md = acct?.data?.parsed?.info?.extensions?.find((e) => e.extension === "tokenMetadata")?.state;
    // Token text comes from a mint anyone could have created: kept short and as plain text.
    token = {
      name: typeof md?.name === "string" ? md.name.slice(0, 64) : null,
      symbol: typeof md?.symbol === "string" ? md.symbol.slice(0, 16) : null,
      supply: sup?.amount ?? null,
      decimals: typeof sup?.decimals === "number" ? sup.decimals : null,
      program: acct?.owner ?? null,
    };
  }
  return {
    at: Date.now(),
    slot,
    blockTime: typeof blockTime === "number" ? blockTime : null,
    slotPace: slots > 0 ? secs / slots : null,
    priorityFee: median(fees),
    prices,
    usdcSupply: usdc,
    token,
  };
}
