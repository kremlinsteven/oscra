import "server-only";
import { decodeFunctionResult, encodeFunctionData, type Abi } from "viem";
import { BRAND, USDG, isAddress } from "@/config/brand";
import { CONTRACTS, keelLive, runbookLive } from "@/config/contracts";
import { LANES } from "@/config/lanes";
import { ERC20_ABI, FEED_ABI, KEEL_ABI, RUNBOOK_ABI } from "@/lib/abi";
import { rpcBatch } from "@/lib/feeds/rpc";

/*
 * Live facts for the whole site, all read from Robinhood Chain: the latest block, gas and block pace, the
 * Chainlink price of every lane, USDG's supply, the OscraRunbook and OscraKeel totals once deployed, and the
 * token once its address is published. Nothing here is typed in.
 */

export type LanePrice = { id: number; price: number | null; updatedAt: number | null };

export type ChainSnapshot = {
  at: number;
  block: number | null;
  blockTime: number | null;
  /** Average seconds per block over the last 1,000 blocks. */
  blockPace: number | null;
  gasGwei: number | null;
  prices: LanePrice[];
  usdgSupply: string | null;
  runbook: { live: boolean; plans: number | null; signals: number | null; bound: boolean | null };
  keel: { live: boolean; staked: string | null; poured: string | null; polls: number | null };
  token: { name: string | null; symbol: string | null; supply: string | null; decimals: number | null } | null;
};

type Read = { to: string; abi: Abi; fn: string; args?: readonly unknown[] };
const call = (r: Read) => ({ method: "eth_call", params: [{ to: r.to, data: encodeFunctionData({ abi: r.abi, functionName: r.fn, args: r.args ?? [] } as never) }, "latest"] });

function decode<T>(r: Read, raw: unknown): T | null {
  if (typeof raw !== "string" || raw.length < 4) return null;
  try {
    return decodeFunctionResult({ abi: r.abi, functionName: r.fn, data: raw as `0x${string}` } as never) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "bigint" ? v.toString() : null);

export async function readSnapshot(): Promise<ChainSnapshot> {
  const ca = isAddress(BRAND.ca) ? BRAND.ca : null;
  const reads: Read[] = LANES.map((l) => ({ to: l.feed, abi: FEED_ABI as Abi, fn: "latestRoundData" }));
  const supplyAt = reads.length;
  reads.push({ to: USDG.address, abi: ERC20_ABI as Abi, fn: "totalSupply" });
  const runbookAt = reads.length;
  if (runbookLive()) {
    reads.push({ to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "planCount" }, { to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "signalCount" }, { to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "sink" });
  }
  const keelAt = reads.length;
  if (keelLive()) {
    reads.push({ to: CONTRACTS.keel, abi: KEEL_ABI, fn: "totalStaked" }, { to: CONTRACTS.keel, abi: KEEL_ABI, fn: "totalPoured" }, { to: CONTRACTS.keel, abi: KEEL_ABI, fn: "pollCount" });
  }
  const tokenAt = reads.length;
  if (ca) for (const fn of ["name", "symbol", "totalSupply", "decimals"]) reads.push({ to: ca, abi: ERC20_ABI as Abi, fn });

  const head = [
    { method: "eth_getBlockByNumber", params: ["latest", false] },
    { method: "eth_gasPrice", params: [] },
  ];
  const [h, results] = await Promise.all([rpcBatch<unknown>(head).catch(() => head.map(() => null)), rpcBatch<unknown>(reads.map(call)).catch(() => reads.map(() => null))]);
  const block = h[0] && typeof h[0] === "object" ? (h[0] as { number: string; timestamp: string }) : null;
  const gas = typeof h[1] === "string" ? h[1] : null;
  let pace: number | null = null;
  if (block && BigInt(block.number) > 1000n) {
    const back = await rpcBatch<{ timestamp: string }>([{ method: "eth_getBlockByNumber", params: [`0x${(BigInt(block.number) - 1000n).toString(16)}`, false] }]).catch(() => [null]);
    if (back[0]) pace = (Number(BigInt(block.timestamp)) - Number(BigInt(back[0].timestamp))) / 1000;
  }

  const prices: LanePrice[] = LANES.map((l, k) => {
    const v = decode<readonly [bigint, bigint, bigint, bigint, bigint]>(reads[k], results[k]);
    return { id: l.id, price: v && v[1] > 0n ? Number(v[1]) / 1e8 : null, updatedAt: v ? Number(v[3]) : null };
  });
  const supply = decode<bigint>(reads[supplyAt], results[supplyAt]);

  const runbook: ChainSnapshot["runbook"] = { live: runbookLive(), plans: null, signals: null, bound: null };
  if (runbookLive()) {
    const plans = decode<bigint>(reads[runbookAt], results[runbookAt]);
    const signals = decode<bigint>(reads[runbookAt + 1], results[runbookAt + 1]);
    const sink = decode<string>(reads[runbookAt + 2], results[runbookAt + 2]);
    runbook.plans = plans === null ? null : Number(plans);
    runbook.signals = signals === null ? null : Number(signals);
    runbook.bound = sink === null ? null : !/^0x0{40}$/i.test(sink);
  }
  const keel: ChainSnapshot["keel"] = { live: keelLive(), staked: null, poured: null, polls: null };
  if (keelLive()) {
    keel.staked = str(decode<bigint>(reads[keelAt], results[keelAt]));
    keel.poured = str(decode<bigint>(reads[keelAt + 1], results[keelAt + 1]));
    const polls = decode<bigint>(reads[keelAt + 2], results[keelAt + 2]);
    keel.polls = polls === null ? null : Number(polls);
  }
  let token: ChainSnapshot["token"] = null;
  if (ca) {
    const [n, s, sup, dec] = reads.slice(tokenAt, tokenAt + 4).map((r, k) => decode<string | bigint | number>(r, results[tokenAt + k]));
    // Token text comes from a contract anyone could have deployed: kept short and as plain text.
    token = { name: typeof n === "string" ? n.slice(0, 64) : null, symbol: typeof s === "string" ? s.slice(0, 16) : null, supply: typeof sup === "bigint" ? sup.toString() : null, decimals: dec === null ? null : Number(dec) };
  }
  return {
    at: Date.now(),
    block: block ? Number(BigInt(block.number)) : null,
    blockTime: block ? Number(BigInt(block.timestamp)) : null,
    blockPace: pace,
    gasGwei: gas ? Number(BigInt(gas)) / 1e9 : null,
    prices,
    usdgSupply: str(supply),
    runbook,
    keel,
    token,
  };
}
