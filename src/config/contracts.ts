import { isAddress } from "@/config/brand";

/*
 * OSCRA contract addresses on Robinhood Chain. Empty until the owner deploys them from /deploy (local only).
 * While `runbook` is empty every workspace screen runs in practice mode (kept in this browser, nothing sent).
 * Once filled, the same screens send real transactions and read the contract. Then run `npm run verify-deployment`.
 */
const DEPLOYED = {
  /** OscraRunbook: recurring buys, desks, follows. Needs no token; can go live now. */
  runbook: "0x1b9ac660b034e7ed285518a18443af12a854eb92",
  /** OscraKeel: $OSCRA staking, USDG fee share, polls. Needs the token address (after launch). */
  keel: "",
  /** Block of the OscraRunbook deployment: event scans start here. */
  fromBlock: 89189094,
};

/**
 * Local fork tests only: NEXT_PUBLIC_OSCRA_TEST_CONTRACTS='{"runbook":"0x…","keel":"0x…","fromBlock":1}' at build
 * time points a second build at contracts deployed on an anvil fork. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_OSCRA_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as typeof DEPLOYED;
    return isAddress(v.runbook) ? { runbook: v.runbook, keel: isAddress(v.keel) ? v.keel : "", fromBlock: Number(v.fromBlock) || 0 } : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;
export const IS_TEST_CHAIN = testOverride() !== null;

export const runbookLive = () => isAddress(CONTRACTS.runbook);
export const keelLive = () => isAddress(CONTRACTS.keel);

export const CONTRACT_NAMES = { runbook: "OscraRunbook", keel: "OscraKeel" } as const;
