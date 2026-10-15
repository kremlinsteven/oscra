/*
 * Wallet-signed records, shared by the browser and the server. Every write (desk idea, follow, skip, copied fill,
 * poll, vote) is a message the wallet signs with signMessage over a one-time server nonce; the server rebuilds the
 * exact text and checks the ed25519 signature against the base58 public key. Nothing here moves funds.
 */
import { BRAND } from "@/config/brand";

export const ACTIONS = ["post-idea", "follow", "unfollow", "skip", "record-fill", "open-poll", "vote"] as const;
export type Action = (typeof ACTIONS)[number];

export type FollowTerms = {
  perSignal: number;
  dayCap: number;
  maxCost: number;
  laneMask: number;
  reviewDelay: number;
  slipBps: number;
  chaseBps: number;
  stopBps: number;
};

export type Idea = { id: number; leader: string; lane: number; sell: boolean; weightBps: number; at: number; price: number };
export type FollowRecord = FollowTerms & { leader: string; since: number };
export type Fill = { signal: number; lane: number; sell: boolean; usdc: number; qty: number; signature: string; at: number };
export type Poll = { id: number; author: string; title: string; choices: string[]; start: number; end: number; tally: number[]; voters: number };

export type Board = {
  configured: boolean;
  tokenLive: boolean;
  ideas: Idea[];
  polls: Poll[];
  mine: { follows: FollowRecord[]; handled: Record<number, "copied" | "skipped">; fills: Fill[]; votes: Record<number, number> } | null;
};

/** Sorted-key JSON, so the browser and the server hash the same bytes. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function recordMessage(o: { wallet: string; action: Action; payloadHash: string; nonce: string; issuedAt: string }) {
  return [
    `${BRAND.domain} wants you to sign an ${BRAND.name} record with your Solana account:`,
    o.wallet,
    "",
    "This signature moves no funds and costs nothing.",
    "",
    `Action: ${o.action}`,
    `Payload SHA-256: ${o.payloadHash}`,
    `Nonce: ${o.nonce}`,
    `Issued At: ${o.issuedAt}`,
  ].join("\n");
}

export type SignedRecord = { wallet: string; action: Action; payload: unknown; nonce: string; issuedAt: string; signature: string };
