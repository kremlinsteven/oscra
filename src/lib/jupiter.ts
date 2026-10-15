/*
 * Jupiter, called from the browser with the user's wallet. Nothing here holds keys or funds:
 *   Recurring (time-based DCA)  createOrder / cancelOrder return an unsigned transaction; the wallet signs it and
 *                                Jupiter's execute endpoint lands it. Orders are read back by wallet address.
 *   Swap                         quote, then a swap transaction for the wallet to sign and send itself.
 * Free endpoints (lite-api.jup.ag), no API key.
 */

const BASE = "https://lite-api.jup.ag";

async function jfetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok || !body) throw new Error((body && (body.error || body.message)) || `Jupiter ${res.status}`);
  return body;
}

export type RecurringParams = {
  user: string;
  inputMint: string;
  outputMint: string;
  /** Total input in base units, split across `numberOfOrders`. */
  inAmount: bigint;
  numberOfOrders: number;
  intervalSec: number;
  /** Price range per output token in USD (input per output); orders outside it wait. Null = none. */
  minPrice: number | null;
  maxPrice: number | null;
  startAt: number | null;
};

export async function createRecurring(p: RecurringParams) {
  return jfetch<{ requestId: string; transaction: string }>("/recurring/v1/createOrder", {
    method: "POST",
    body: JSON.stringify({
      user: p.user,
      inputMint: p.inputMint,
      outputMint: p.outputMint,
      params: { time: { inAmount: Number(p.inAmount), numberOfOrders: p.numberOfOrders, interval: p.intervalSec, minPrice: p.minPrice, maxPrice: p.maxPrice, startAt: p.startAt } },
    }),
  });
}

export async function cancelRecurring(user: string, order: string) {
  return jfetch<{ requestId: string; transaction: string }>("/recurring/v1/cancelOrder", { method: "POST", body: JSON.stringify({ order, user, recurringType: "time" }) });
}

export async function executeRecurring(requestId: string, signedTransaction: string) {
  return jfetch<{ status: string; signature?: string; order?: string; error?: string }>("/recurring/v1/execute", { method: "POST", body: JSON.stringify({ requestId, signedTransaction }) });
}

export type RecurringOrder = {
  orderKey: string;
  inputMint: string;
  outputMint: string;
  inDeposited: string;
  inWithdrawn: string;
  inUsed: string;
  outReceived: string;
  rawInDeposited?: string;
  rawInUsed?: string;
  rawOutReceived?: string;
  inAmountPerCycle: string;
  cycleFrequency: string;
  minOutAmount?: string;
  maxOutAmount?: string;
  createdAt: string;
  updatedAt: string;
  openTx: string;
  closeTx?: string;
  userClosed?: boolean;
  trades?: { inputAmount: string; outputAmount: string; txId: string; confirmedAt: string }[];
};

export async function listRecurring(user: string, status: "active" | "history") {
  const q = new URLSearchParams({ user, orderStatus: status, recurringType: "time", includeFailedTx: "false", page: "1" });
  const body = await jfetch<{ time?: RecurringOrder[] }>(`/recurring/v1/getRecurringOrders?${q}`);
  return body.time ?? [];
}

export type Quote = { inAmount: string; outAmount: string; otherAmountThreshold: string; priceImpactPct: string; slippageBps: number; routePlan?: { swapInfo?: { label?: string } }[] } & Record<string, unknown>;

export async function quote(inputMint: string, outputMint: string, amount: bigint, slippageBps: number) {
  const q = new URLSearchParams({ inputMint, outputMint, amount: amount.toString(), slippageBps: String(slippageBps), restrictIntermediateTokens: "true" });
  return jfetch<Quote>(`/swap/v1/quote?${q}`);
}

export async function swapTransaction(user: string, q: Quote) {
  return jfetch<{ swapTransaction: string; lastValidBlockHeight: number }>("/swap/v1/swap", {
    method: "POST",
    body: JSON.stringify({ quoteResponse: q, userPublicKey: user, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true, prioritizationFeeLamports: "auto" }),
  });
}

export const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const bytesToB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
