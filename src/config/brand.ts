// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The
// navbar copy pill, the footer, the token page and every explorer link derive
// from it. Anything that is not a 0x + 40 hex address is treated as "not launched yet".

const CA = "0xxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

/**
 * True once the domain points at this deployment. While false, the production *.vercel.app host is
 * served as is (kept out of search with noindex) instead of redirecting to a domain that does not resolve.
 * Checked 15 Oct 2026: oscra.xyz is registered (Namecheap, created that day) but has no DNS records yet.
 */
export const DOMAIN_LIVE = false;

export const isAddress = (v: string): v is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(v);

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
  chainName: "Robinhood Chain",
  description: `${NAME} is a non-custodial trading workspace on Robinhood Chain: recurring buys and copied trades run from your own wallet under limits you write, with a rule-based review before you commit.`,
  x: `https://x.com/${X_HANDLE}`,
  xHandle: `@${X_HANDLE}`,
  // Public source repository. Empty until the owner publishes it; the site hides every GitHub link meanwhile.
  github: "",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);

// Public endpoints are the default. An operator can point the site at a
// private RPC with ROBINHOOD_RPC_URL (server) / NEXT_PUBLIC_ROBINHOOD_RPC_URL
// (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  /** Third read endpoint for server code (some networks intercept the official host). */
  spareRpc: "https://robinhood.drpc.org",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return process.env.ROBINHOOD_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC;
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
  return `${CHAIN.explorer}/address/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function explorerTx(hash: string) {
  return `${CHAIN.explorer}/tx/${hash}`;
}
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** USDG ("Global Dollar") on Robinhood Chain. Read on-chain: symbol USDG, 6 decimals. */
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
} as const;

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

/** Uniswap v3 SwapRouter02 on Robinhood Chain (exactInputSingle without a deadline field). */
export const SWAP_ROUTER = "0xCaf681a66D020601342297493863E78C959E5cb2";

/** Pons launch page for the token once it exists. */
export const PONS_TOKEN_URL = (ca: string) => `https://www.ponsfamily.com/launchpad/${ca}`;
