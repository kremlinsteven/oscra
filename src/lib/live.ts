/*
 * Browser reads of a wallet's real state on Robinhood Chain: balances, the USDG allowance to the Runbook, and,
 * once the OscraRunbook is deployed, the wallet's plans, follows, copied holdings and the ideas of the desks it
 * follows. Everything goes through src/lib/client.ts (site relay first, then public RPCs).
 */
import type { Abi } from "viem";
import { USDG } from "@/config/brand";
import { CONTRACTS, keelLive, runbookLive } from "@/config/contracts";
import { LANES } from "@/config/lanes";
import { ERC20_ABI, KEEL_ABI, RUNBOOK_ABI } from "@/lib/abi";
import { readMany, rpcCall } from "@/lib/client";

const erc = ERC20_ABI as Abi;

export type Wallet = {
  eth: bigint | null;
  usdg: bigint | null;
  allowance: bigint | null;
  assets: (bigint | null)[];
  assetAllowance: (bigint | null)[];
};

export async function readWallet(address: string): Promise<Wallet> {
  const rb = runbookLive() ? CONTRACTS.runbook : null;
  const reads = [
    { to: USDG.address, abi: erc, fn: "balanceOf", args: [address] },
    ...(rb ? [{ to: USDG.address, abi: erc, fn: "allowance", args: [address, rb] }] : []),
    ...LANES.map((l) => ({ to: l.asset, abi: erc, fn: "balanceOf", args: [address] })),
    ...(rb ? LANES.map((l) => ({ to: l.asset, abi: erc, fn: "allowance", args: [address, rb] })) : []),
  ];
  const [out, eth] = await Promise.all([readMany(reads), rpcCall<string>("eth_getBalance", [address, "latest"]).catch(() => null)]);
  let k = 0;
  const usdg = out[k++] as bigint | null;
  const allowance = rb ? (out[k++] as bigint | null) : null;
  const assets = LANES.map(() => out[k++] as bigint | null);
  const assetAllowance = rb ? LANES.map(() => out[k++] as bigint | null) : LANES.map(() => null);
  return { eth: eth ? BigInt(eth) : null, usdg, allowance, assets, assetAllowance };
}

export type ChainPlan = {
  id: number;
  owner: string;
  lane: number;
  state: number;
  slipBps: number;
  guardBps: number;
  targetBps: number;
  interval: number;
  buys: number;
  nextAt: number;
  perBuy: bigint;
  budget: bigint;
  spent: bigint;
  netIn: bigint;
  bought: bigint;
  ceiling: bigint;
  tip: bigint;
  avg: bigint;
};

export const PLAN_STATES = ["active", "held", "guarded", "targeted", "spent", "closed"] as const;

export async function readPlans(address: string): Promise<ChainPlan[]> {
  if (!runbookLive()) return [];
  const [ids] = (await readMany([{ to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "plansOf", args: [address] }])) as [readonly bigint[] | null];
  if (!ids?.length) return [];
  const list = ids.slice(-40);
  const out = await readMany(list.flatMap((id) => [{ to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "planAt", args: [id] }, { to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "averageEntry", args: [id] }]));
  return list
    .map((id, i) => {
      const p = out[i * 2] as Record<string, unknown> | null;
      if (!p) return null;
      return {
        id: Number(id),
        owner: String(p.owner),
        lane: Number(p.lane),
        state: Number(p.state),
        slipBps: Number(p.slipBps),
        guardBps: Number(p.guardBps),
        targetBps: Number(p.targetBps),
        interval: Number(p.interval),
        buys: Number(p.buys),
        nextAt: Number(p.nextAt),
        perBuy: p.perBuy as bigint,
        budget: p.budget as bigint,
        spent: p.spent as bigint,
        netIn: p.netIn as bigint,
        bought: p.bought as bigint,
        ceiling: p.ceiling as bigint,
        tip: p.tip as bigint,
        avg: (out[i * 2 + 1] as bigint | null) ?? 0n,
      } satisfies ChainPlan;
    })
    .filter((p): p is ChainPlan => p !== null)
    .reverse();
}

export type ChainFollow = {
  leader: string;
  active: boolean;
  slipBps: number;
  chaseBps: number;
  stopBps: number;
  laneMask: number;
  reviewDelay: number;
  since: number;
  dayStart: number;
  perSignal: bigint;
  dayCap: bigint;
  daySpent: bigint;
  maxCost: bigint;
  tip: bigint;
  holdings: { lane: number; qty: bigint; cost: bigint }[];
};

export type ChainSignal = { id: number; leader: string; lane: number; sell: boolean; weightBps: number; at: number; price: bigint; handled: boolean };

export async function readFollows(address: string): Promise<{ follows: ChainFollow[]; signals: ChainSignal[] }> {
  if (!runbookLive()) return { follows: [], signals: [] };
  const rb = CONTRACTS.runbook;
  const [desks] = (await readMany([{ to: rb, abi: RUNBOOK_ABI, fn: "desksOf", args: [address] }])) as [readonly string[] | null];
  if (!desks?.length) return { follows: [], signals: [] };
  const list = desks.slice(0, 12);
  const per = 1 + LANES.length + 1;
  const out = await readMany(
    list.flatMap((d) => [
      { to: rb, abi: RUNBOOK_ABI, fn: "followOf", args: [address, d] },
      ...LANES.map((l) => ({ to: rb, abi: RUNBOOK_ABI, fn: "holdings", args: [address, d, l.id] })),
      { to: rb, abi: RUNBOOK_ABI, fn: "signalsOf", args: [d] },
    ]),
  );
  const follows: ChainFollow[] = [];
  const signalIds: number[] = [];
  list.forEach((d, i) => {
    const f = out[i * per] as Record<string, unknown> | null;
    if (!f) return;
    const holdings = LANES.map((l, k) => {
      const h = out[i * per + 1 + k] as readonly [bigint, bigint] | null;
      return { lane: l.id, qty: h?.[0] ?? 0n, cost: h?.[1] ?? 0n };
    }).filter((h) => h.qty > 0n);
    follows.push({
      leader: d,
      active: Boolean(f.active),
      slipBps: Number(f.slipBps),
      chaseBps: Number(f.chaseBps),
      stopBps: Number(f.stopBps),
      laneMask: Number(f.laneMask),
      reviewDelay: Number(f.reviewDelay),
      since: Number(f.since),
      dayStart: Number(f.dayStart),
      perSignal: f.perSignal as bigint,
      dayCap: f.dayCap as bigint,
      daySpent: f.daySpent as bigint,
      maxCost: f.maxCost as bigint,
      tip: f.tip as bigint,
      holdings,
    });
    const ids = (out[i * per + per - 1] as readonly bigint[] | null) ?? [];
    for (const id of ids.slice(-15)) signalIds.push(Number(id));
  });
  if (!signalIds.length) return { follows, signals: [] };
  const sOut = await readMany(signalIds.flatMap((id) => [{ to: rb, abi: RUNBOOK_ABI, fn: "signalAt", args: [BigInt(id)] }, { to: rb, abi: RUNBOOK_ABI, fn: "handled", args: [address, BigInt(id)] }]));
  const signals = signalIds
    .map((id, i) => {
      const s = sOut[i * 2] as Record<string, unknown> | null;
      if (!s) return null;
      return { id, leader: String(s.leader), lane: Number(s.lane), sell: Boolean(s.sell), weightBps: Number(s.weightBps), at: Number(s.at), price: s.price as bigint, handled: Boolean(sOut[i * 2 + 1]) };
    })
    .filter((s): s is ChainSignal => s !== null)
    .sort((a, b) => b.id - a.id);
  return { follows, signals };
}

export async function readFeeRate(address: string): Promise<number | null> {
  if (!runbookLive()) return null;
  const [r] = await readMany([{ to: CONTRACTS.runbook, abi: RUNBOOK_ABI, fn: "feeRateOf", args: [address] }]);
  return r === null ? null : Number(r as bigint);
}

export type KeelState = {
  staked: bigint | null;
  total: bigint | null;
  claimable: bigint | null;
  lockedUntil: number;
  tokenBalance: bigint | null;
  tokenAllowance: bigint | null;
  polls: { id: number; author: string; end: number; choices: number; tallies: bigint[]; ballot: number }[];
};

export async function readKeel(address: string | null, token: string | null): Promise<KeelState | null> {
  if (!keelLive()) return null;
  const k = CONTRACTS.keel;
  const who = address ?? "0x0000000000000000000000000000000000000000";
  const out = await readMany([
    { to: k, abi: KEEL_ABI, fn: "stakedOf", args: [who] },
    { to: k, abi: KEEL_ABI, fn: "totalStaked" },
    { to: k, abi: KEEL_ABI, fn: "claimable", args: [who] },
    { to: k, abi: KEEL_ABI, fn: "lockedUntil", args: [who] },
    { to: k, abi: KEEL_ABI, fn: "pollCount" },
    ...(token ? [{ to: token, abi: erc, fn: "balanceOf", args: [who] }, { to: token, abi: erc, fn: "allowance", args: [who, k] }] : []),
  ]);
  const count = Number((out[4] as bigint | null) ?? 0n);
  const ids = Array.from({ length: Math.min(count, 12) }, (_, i) => count - 1 - i);
  const pOut = ids.length
    ? await readMany(ids.flatMap((id) => [{ to: k, abi: KEEL_ABI, fn: "pollAt", args: [BigInt(id)] }, { to: k, abi: KEEL_ABI, fn: "tallies", args: [BigInt(id)] }, { to: k, abi: KEEL_ABI, fn: "ballot", args: [BigInt(id), who] }]))
    : [];
  return {
    staked: out[0] as bigint | null,
    total: out[1] as bigint | null,
    claimable: out[2] as bigint | null,
    lockedUntil: Number((out[3] as bigint | null) ?? 0n),
    tokenBalance: token ? (out[5] as bigint | null) : null,
    tokenAllowance: token ? (out[6] as bigint | null) : null,
    polls: ids
      .map((id, i) => {
        const p = pOut[i * 3] as Record<string, unknown> | null;
        if (!p) return null;
        return { id, author: String(p.author), end: Number(p.end), choices: Number(p.choices), tallies: ((pOut[i * 3 + 1] as readonly bigint[] | null) ?? []).slice(), ballot: Number((pOut[i * 3 + 2] as number | bigint | null) ?? 0) };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  };
}

/** Poll titles and choices live only in the PollOpened event: read from recent logs through the relay. */
export async function readPollText(): Promise<Record<number, { title: string; choices: string[] }>> {
  if (!keelLive()) return {};
  const { decodeEventLog, toEventSelector } = await import("viem");
  const ev = (KEEL_ABI as Abi).find((x) => x.type === "event" && x.name === "PollOpened");
  if (!ev || ev.type !== "event") return {};
  const topic = toEventSelector(ev);
  const head = Number(BigInt(await rpcCall<string>("eth_blockNumber", [])));
  const out: Record<number, { title: string; choices: string[] }> = {};
  const from = Math.max(CONTRACTS.fromBlock, 0);
  // Newest first, at most ten windows of 20,000 blocks (the relay's span limit).
  for (let to = head, n = 0; to >= from && n < 10; to -= 20_000, n++) {
    const start = Math.max(from, to - 19_999);
    const logs = await rpcCall<{ topics: `0x${string}`[]; data: `0x${string}` }[]>("eth_getLogs", [{ address: CONTRACTS.keel, topics: [topic], fromBlock: `0x${start.toString(16)}`, toBlock: `0x${to.toString(16)}` }]).catch(() => []);
    for (const l of logs) {
      try {
        const d = decodeEventLog({ abi: [ev], data: l.data, topics: l.topics as [`0x${string}`, ...`0x${string}`[]] }) as unknown as { args: { id: bigint; title: string; choices: readonly string[] } };
        out[Number(d.args.id)] = { title: d.args.title.slice(0, 200), choices: d.args.choices.map((c) => c.slice(0, 64)) };
      } catch {
        // not decodable: skipped
      }
    }
  }
  return out;
}
