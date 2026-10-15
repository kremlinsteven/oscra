import "server-only";
import { CHAIN, serverRpc } from "@/config/brand";
import { readCappedResponse } from "@/lib/server/capped";

/*
 * Solana JSON-RPC reads from the server. The configured endpoint is tried first, then the public fallback.
 * Reads only: nothing here signs or sends a transaction.
 */

const endpoints = () => [serverRpc(), CHAIN.fallbackRpc].filter((url, i, all) => all.indexOf(url) === i);
let preferred = 0;

export class RpcError extends Error {
  constructor(message: string, readonly revert = false, readonly data: string | null = null) {
    super(message);
  }
}

/** Largest upstream answer any server read accepts; the stream is aborted past it. */
export const MAX_RESPONSE_BYTES = 2_000_000;

async function post(url: string, body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: ctrl.signal });
    if (!res.ok || !res.body) throw new RpcError(`RPC ${res.status}`);
    const text = await readCappedResponse(res, MAX_RESPONSE_BYTES);
    if (text === null) {
      ctrl.abort();
      // Final: the same query is just as large on any endpoint.
      throw new RpcError("Upstream response too large.", true);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const list = endpoints();
  let last: unknown;
  for (let n = 0; n < list.length; n++) {
    const i = (preferred + n) % list.length;
    try {
      const body = (await post(list[i], { jsonrpc: "2.0", id: 1, method, params })) as {
        result?: T;
        error?: { message: string; code?: number; data?: unknown };
      };
      if (body.error) {
        // Invalid params and similar are answers about this query, not outages: do not try the next endpoint.
        // Rate limits (429 / -32005) and server errors are retried elsewhere.
        const final = body.error.code === -32602 || body.error.code === -32600 || body.error.code === -32601;
        throw new RpcError(body.error.message, final);
      }
      preferred = i;
      return body.result as T;
    } catch (error) {
      if (error instanceof RpcError && error.revert) throw error;
      last = error;
    }
  }
  throw last;
}

export async function rpcBatch<T>(calls: { method: string; params: unknown[] }[]): Promise<(T | null)[]> {
  if (calls.length === 0) return [];
  const list = endpoints();
  let last: unknown;
  for (let n = 0; n < list.length; n++) {
    const i = (preferred + n) % list.length;
    try {
      const body = (await post(
        list[i],
        calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c })),
      )) as { id: number; result?: T; error?: unknown }[];
      if (!Array.isArray(body)) throw new RpcError("batch unsupported");
      preferred = i;
      const out: (T | null)[] = calls.map(() => null);
      for (const entry of body) if (!entry.error && entry.result !== undefined) out[entry.id] = entry.result;
      return out;
    } catch (error) {
      if (error instanceof RpcError && error.revert) throw error;
      last = error;
    }
  }
  throw last;
}

