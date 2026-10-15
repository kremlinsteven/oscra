// Single place to change project identity. Everything on the site reads from here.
// To publish the real token address, replace the value of CA below with the $OSCRA mint (base58, from pump.fun).
// The navbar copy pill, the footer, the token page, poll weights and every explorer link derive from it.
// Anything that is not a Solana base58 address is treated as "not launched yet".

const CA = "0xxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

/**
 * True once the domain points at this deployment. While false, the production *.vercel.app host is
 * served as is (kept out of search with noindex) instead of redirecting to a domain that does not resolve.
 * Checked 16 Oct 2026: oscra.xyz serves this deployment on Vercel (apex and www answer).
 */
export const DOMAIN_LIVE = true;

/** Solana address (base58, 32 to 44 characters). The "0xxxx" placeholder fails this on purpose. */
export const isAddress = (v: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

const NAME = "OSCRA";
const SLUG = "oscra";
const TICKER = "OSCRA";
const DOMAIN = "oscra.xyz";
const X_HANDLE = "oscra";

export const BRAND = {
  name: NAME,
  /** Lowercase id for package names and the like. */
  slug: SLUG,
  ticker: TICKER,
  symbol: `$${TICKER}`,
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  slogan: "Automate With Control. Trade With Confidence.",
  tagline: "Oscra: Non-custodial trading automation. AI review. Visible controls. Your assets stay yours.",
  category: "non-custodial trading workspace",
  chainName: "Solana",
  description: `${NAME} is a non-custodial trading workspace on Solana: recurring buys and copied trades run from your own wallet under limits you write, with a rule-based review before you commit.`,
  x: `https://x.com/${X_HANDLE}`,
  xHandle: `@${X_HANDLE}`,
  // Public source repository. Empty until the owner publishes it; the site hides every GitHub link meanwhile.
  github: "",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);

// Public endpoints are the default. An operator can point the site at a private RPC with SOLANA_RPC_URL (server) /
// NEXT_PUBLIC_SOLANA_RPC_URL (browser). Both are optional.
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
/**
 * Browser default. api.mainnet-beta.solana.com answers 403 to any request that carries a browser Origin, so
 * wallet sends, blockhash and balance reads from the page must use an endpoint that allows browsers.
 */
const BROWSER_RPC = "https://solana-rpc.publicnode.com";

export const CHAIN = {
  name: "Solana",
  cluster: "mainnet-beta",
  nativeSymbol: "SOL",
  decimals: 9,
  publicRpc: PUBLIC_RPC,
  /** Browser RPC (wallet adapter Connection and direct browser reads). */
  rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || BROWSER_RPC,
  /** Second public endpoint for server reads when the first one fails. */
  fallbackRpc: "https://solana-rpc.publicnode.com",
  explorer: "https://solscan.io",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || PUBLIC_RPC;
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
};

export function explorerAddress(address: string) {
  return `${CHAIN.explorer}/account/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function explorerTx(signature: string) {
  return `${CHAIN.explorer}/tx/${signature}`;
}
export function shortAddress(address: string, head = 4, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** USDC on Solana (classic SPL Token, 6 decimals). Every plan and copied trade is priced in it. */
export const USDC = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
} as const;

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/** pump.fun page and chart of the token once it exists. */
export const PUMP_TOKEN_URL = (mint: string) => `https://pump.fun/coin/${mint}`;
export const DEXSCREENER_TOKEN_URL = (mint: string) => `https://dexscreener.com/solana/${mint}`;

/** pump.fun tokens: 1,000,000,000 supply, 6 decimals. */
export const TOKEN_DECIMALS = 6;
