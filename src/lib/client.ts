import { BRAND, CHAIN, USDC, isAddress } from "@/config/brand";
import { LANES } from "@/config/lanes";

/*
 * Browser-side Solana reads. They go through the site relay first (the public RPC rate-limits browsers), then the
 * configured RPC. Reads only: wallets send their own transactions.
 */

const ENDPOINTS = ["/api/rpc", CHAIN.rpc].filter((u, i, all) => all.indexOf(u) === i);
let preferred = 0;

type RpcBody = { id?: number; result?: unknown; error?: { message?: string; code?: number } | string };

/** One JSON-RPC call with endpoint fallback. */
export async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  let last: unknown = null;
  for (let n = 0; n < ENDPOINTS.length; n++) {
    const index = (preferred + n) % ENDPOINTS.length;
    try {
      const res = await fetch(ENDPOINTS[index], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store" });
      const body = (await res.json().catch(() => null)) as RpcBody | null;
      if (!body) throw new Error(`RPC ${res.status}`);
      if (typeof body.error === "string") throw new Error(body.error);
      if (body.error) throw new Error(body.error.message ?? "RPC error");
      preferred = index;
      return body.result as T;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Solana could not be reached.");
}

/** A batch where each entry may fail on its own (null), with endpoint fallback for the whole batch. */
export async function rpcBatchLoose(calls: { method: string; params: unknown[] }[]): Promise<(unknown | null)[]> {
  if (calls.length === 0) return [];
  let last: unknown = null;
  for (let n = 0; n < ENDPOINTS.length; n++) {
    const index = (preferred + n) % ENDPOINTS.length;
    try {
      const res = await fetch(ENDPOINTS[index], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))), cache: "no-store" });
      const body = (await res.json().catch(() => null)) as RpcBody[] | RpcBody | null;
      if (!Array.isArray(body)) throw new Error(typeof body?.error === "string" ? body.error : `RPC ${res.status}`);
      const out: (unknown | null)[] = calls.map(() => null);
      for (const e of body) if (typeof e.id === "number" && !e.error && e.result !== undefined) out[e.id] = e.result;
      preferred = index;
      return out;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Solana could not be reached.");
}

/** Wallet balances in base units: SOL (lamports), USDC, every lane asset and $OSCRA once launched. */
export type Wallet = { sol: bigint | null; usdc: bigint | null; assets: (bigint | null)[]; oscra: bigint | null };

type TokenAccounts = { value?: { account: { data: { parsed?: { info?: { tokenAmount?: { amount: string } } } } } }[] };

const sumAccounts = (v: unknown) => {
  const list = (v as TokenAccounts | null)?.value;
  if (!Array.isArray(list)) return null;
  return list.reduce((a, x) => a + BigInt(x.account.data.parsed?.info?.tokenAmount?.amount ?? "0"), 0n);
};

export async function readWallet(owner: string): Promise<Wallet> {
  const mints = [USDC.mint, ...LANES.map((l) => l.mint), ...(isAddress(BRAND.ca) ? [BRAND.ca] : [])];
  const calls = [
    { method: "getBalance", params: [owner, { commitment: "confirmed" }] },
    ...mints.map((mint) => ({ method: "getTokenAccountsByOwner", params: [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }] })),
  ];
  const r = await rpcBatchLoose(calls);
  const sol = (r[0] as { value?: number } | null)?.value;
  const tokens = r.slice(1).map(sumAccounts);
  return {
    sol: typeof sol === "number" ? BigInt(sol) : null,
    usdc: tokens[0],
    // Wrapped SOL lane: the wallet's native SOL counts too.
    assets: LANES.map((l, i) => tokens[i + 1]),
    oscra: isAddress(BRAND.ca) ? tokens[mints.length - 1] : null,
  };
}

/** Waits until a signature is confirmed (or fails). */
export async function waitForSignature(signature: string, timeoutMs = 90_000): Promise<{ ok: boolean; error: string | null }> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const r = await rpcCall<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [[signature]]).catch(() => null);
    const s = r?.value?.[0];
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return { ok: s.err === null, error: s.err ? JSON.stringify(s.err).slice(0, 120) : null };
    await new Promise((res) => setTimeout(res, 2000));
  }
  return { ok: false, error: "Not confirmed in time. Check the explorer before trying again." };
}

/** Turns wallet and RPC errors into one plain sentence. */
export function explain(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause ?? "");
  if (/reject|denied|cancel/i.test(text)) return "You declined in the wallet.";
  if (/insufficient|0x1\b|debit an account/i.test(text)) return "Not enough balance for this transaction and its fee.";
  if (/blockhash|expired/i.test(text)) return "The transaction expired before it landed. Try again.";
  if (/429|rate/i.test(text)) return "The RPC is busy. Try again in a moment.";
  return text.slice(0, 200) || "Something went wrong.";
}
