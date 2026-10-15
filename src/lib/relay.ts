import { BRAND, USDC, isAddress } from "@/config/brand";
import { LANES } from "@/config/lanes";

/*
 * Rules for the read-only Solana JSON-RPC relay, kept apart from the route so they can be tested. Every request
 * is priced in units; each network has a budget. Only read methods pass, with shape and size limits; a signed
 * transaction is never forwarded (wallets send their own transactions straight to the RPC).
 */

export const MAX_CALLS = 20;
export const MAX_KEYS = 20;
export const MAX_SIGNATURES = 50;
export const MAX_BODY = 32_768;
export const BUDGET = { units: 600, windowSec: 600, siteUnits: 30_000 };

export const COST: Record<string, number> = {
  getAccountInfo: 1,
  getMultipleAccounts: 3,
  getBalance: 1,
  getTokenAccountsByOwner: 3,
  getTokenAccountBalance: 1,
  getSlot: 1,
  getLatestBlockhash: 1,
  getSignatureStatuses: 1,
  getRecentPrioritizationFees: 2,
  getTransaction: 3,
  getSignaturesForAddress: 5,
  getTokenSupply: 1,
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const ENCODINGS = new Set(["base64", "jsonParsed", "base58"]);
const CONFIG_KEYS = new Set(["commitment", "encoding", "minContextSlot", "dataSlice", "maxSupportedTransactionVersion", "limit", "before", "until", "searchTransactionHistory"]);

/** Mints the site reads: USDC, every lane asset and the token once launched. Token account queries must name one. */
export function readMints(): Set<string> {
  const list = [USDC.mint, ...LANES.map((l) => l.mint)];
  if (isAddress(BRAND.ca)) list.push(BRAND.ca);
  return new Set(list);
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

function checkConfig(v: unknown): string | null {
  if (v === undefined) return null;
  if (!v || typeof v !== "object" || Array.isArray(v)) return "Config must be an object.";
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!CONFIG_KEYS.has(k)) return `Unsupported config field: ${k.slice(0, 32)}`;
    if (k === "encoding" && !ENCODINGS.has(String(x))) return "Unsupported encoding.";
    if (k === "limit" && !(Number.isInteger(x) && (x as number) > 0 && (x as number) <= MAX_SIGNATURES)) return `limit must be 1 to ${MAX_SIGNATURES}.`;
    if (k === "dataSlice" && (typeof x !== "object" || x === null)) return "Bad dataSlice.";
  }
  return null;
}

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], mints = readMints()): { units: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  for (const c of calls) {
    if (!c || typeof c.method !== "string" || !Object.hasOwn(COST, c.method)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const p = c.params ?? [];
    units += COST[c.method];
    switch (c.method) {
      case "getAccountInfo":
      case "getBalance":
      case "getTokenAccountBalance":
      case "getTokenSupply":
      case "getSignaturesForAddress": {
        if (p.length < 1 || p.length > 2 || typeof p[0] !== "string" || !BASE58.test(p[0])) return { error: `${c.method} needs one address.` };
        const bad = checkConfig(p[1]);
        if (bad) return { error: bad };
        if (c.method === "getSignaturesForAddress" && !(p[1] && typeof (p[1] as { limit?: unknown }).limit === "number")) return { error: "getSignaturesForAddress needs a limit." };
        break;
      }
      case "getMultipleAccounts": {
        const keys = p[0];
        if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS || !keys.every((k) => typeof k === "string" && BASE58.test(k))) return { error: `getMultipleAccounts takes 1 to ${MAX_KEYS} addresses.` };
        const bad = checkConfig(p[1]);
        if (bad) return { error: bad };
        break;
      }
      case "getTokenAccountsByOwner": {
        // A mint filter naming a mint the site reads is required: a program-wide filter could list hundreds of accounts.
        const filter = p[1] as { mint?: unknown } | undefined;
        if (typeof p[0] !== "string" || !BASE58.test(p[0])) return { error: "getTokenAccountsByOwner needs an owner." };
        if (!filter || typeof filter !== "object" || Object.keys(filter).length !== 1 || typeof filter.mint !== "string" || !mints.has(filter.mint)) return { error: "getTokenAccountsByOwner needs a mint filter for a mint this site reads." };
        const bad = checkConfig(p[2]);
        if (bad) return { error: bad };
        break;
      }
      case "getSignatureStatuses": {
        const sigs = p[0];
        if (!Array.isArray(sigs) || sigs.length === 0 || sigs.length > MAX_KEYS || !sigs.every((s) => typeof s === "string" && SIGNATURE.test(s))) return { error: "getSignatureStatuses takes 1 to 20 signatures." };
        break;
      }
      case "getTransaction": {
        if (typeof p[0] !== "string" || !SIGNATURE.test(p[0])) return { error: "getTransaction needs a signature." };
        const bad = checkConfig(p[1]);
        if (bad) return { error: bad };
        break;
      }
      case "getRecentPrioritizationFees": {
        const keys = p[0];
        if (keys !== undefined && (!Array.isArray(keys) || keys.length > 128 || !keys.every((k) => typeof k === "string" && BASE58.test(k)))) return { error: "Bad account list." };
        break;
      }
      default: {
        const bad = checkConfig(p[0]);
        if (bad) return { error: bad };
      }
    }
  }
  return { units };
}

export type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: string } } | { down: true };

export type RelayDeps = {
  /** Charges the caller's budgets; returns the refusal message, or null when allowed. */
  charge: (units: number) => Promise<string | null>;
  one: (method: string, params: unknown[]) => Promise<RpcAnswer>;
  many: (calls: { method: string; params: unknown[] }[]) => Promise<(unknown | null)[]>;
};

/**
 * The relay's whole decision, without I/O of its own: shape and price first, then the budget,
 * and only then the upstream RPC. A refused request never reaches the RPC.
 */
export async function runRelay(body: Call | Call[], deps: RelayDeps): Promise<{ status: number; body: unknown }> {
  const calls = Array.isArray(body) ? body : [body];
  const checked = checkBatch(calls);
  if ("error" in checked) return { status: 400, body: { error: checked.error } };
  const refused = await deps.charge(checked.units);
  if (refused) return { status: 429, body: { error: refused } };
  if (calls.length === 1 && !Array.isArray(body)) {
    const c = calls[0];
    const a = await deps.one(c.method, c.params ?? []);
    if ("down" in a) return { status: 502, body: { error: "The chain could not be reached." } };
    return { status: 200, body: { jsonrpc: "2.0", id: c.id ?? null, ...a } };
  }
  try {
    const results = await deps.many(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) =>
      results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] },
    );
    return { status: 200, body: Array.isArray(body) ? out : out[0] };
  } catch {
    return { status: 502, body: { error: "The chain could not be reached." } };
  }
}
