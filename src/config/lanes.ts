/*
 * The markets ("lanes") the OscraRunbook is built with, in constructor order. Fixed forever once deployed.
 * Each asset is identified by address, never by ticker: WETH, and official Robinhood stock tokens (beacon proxies
 * whose name ends in "Robinhood Token"). Each lane swaps against its deepest USDG pool on Uniswap v3 and is
 * priced by the matching Chainlink USD feed. Pool depths and fee tiers were read on-chain on 15 Oct 2026.
 *
 * maxAge: crypto feeds update at least daily (26 h allowed); equity feeds pause outside market hours and over
 * weekends, so they get four days. A buy is refused when its feed is older.
 */

export type LaneKind = "crypto" | "stock";

export type Lane = {
  id: number;
  symbol: string;
  name: string;
  kind: LaneKind;
  asset: `0x${string}`;
  feed: `0x${string}`;
  poolFee: number;
  maxAge: number;
  decimals: number;
};

const CRYPTO_AGE = 93_600;
const STOCK_AGE = 345_600;

export const LANES: Lane[] = [
  { id: 0, symbol: "ETH", name: "Ether (WETH)", kind: "crypto", asset: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", feed: "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9", poolFee: 100, maxAge: CRYPTO_AGE, decimals: 18 },
  { id: 1, symbol: "NVDA", name: "NVIDIA", kind: "stock", asset: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", poolFee: 500, maxAge: STOCK_AGE, decimals: 18 },
  { id: 2, symbol: "SPY", name: "SPDR S&P 500 ETF", kind: "stock", asset: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A", poolFee: 500, maxAge: STOCK_AGE, decimals: 18 },
  { id: 3, symbol: "QQQ", name: "Invesco QQQ", kind: "stock", asset: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae", poolFee: 500, maxAge: STOCK_AGE, decimals: 18 },
  { id: 4, symbol: "AAPL", name: "Apple", kind: "stock", asset: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0", poolFee: 500, maxAge: STOCK_AGE, decimals: 18 },
  { id: 5, symbol: "GOOGL", name: "Alphabet Class A", kind: "stock", asset: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b", poolFee: 500, maxAge: STOCK_AGE, decimals: 18 },
  { id: 6, symbol: "TSLA", name: "Tesla", kind: "stock", asset: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", feed: "0x4A1166a659A55625345e9515b32adECea5547C38", poolFee: 3000, maxAge: STOCK_AGE, decimals: 18 },
  { id: 7, symbol: "MSFT", name: "Microsoft", kind: "stock", asset: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E", poolFee: 3000, maxAge: STOCK_AGE, decimals: 18 },
  { id: 8, symbol: "AMZN", name: "Amazon", kind: "stock", asset: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C", poolFee: 3000, maxAge: STOCK_AGE, decimals: 18 },
  { id: 9, symbol: "META", name: "Meta Platforms", kind: "stock", asset: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1", poolFee: 3000, maxAge: STOCK_AGE, decimals: 18 },
];

export const laneById = (id: number) => LANES.find((l) => l.id === id) ?? null;

/** Fee rates and the holder threshold the Runbook is deployed with (basis points; $OSCRA with 18 decimals). */
export const RUNBOOK_TERMS = {
  feeBps: 20,
  holderFeeBps: 10,
  /** Hold or stake at least this much $OSCRA for the lower rate. Assumes a 1,000,000,000 supply; adjust at deploy. */
  holderMin: 250_000n * 10n ** 18n,
};

/** Keel: minimum stake to open a poll. */
export const KEEL_TERMS = {
  proposerMin: 500_000n * 10n ** 18n,
};

/** Limits written into OscraRunbook (constants in the contract). */
export const LIMITS = {
  minIntervalH: 1,
  maxIntervalD: 90,
  minSlipBps: 50,
  maxSlipBps: 500,
  maxGuardBps: 9_000,
  maxTargetBps: 50_000,
  maxChaseBps: 2_000,
  maxReviewDelayH: 48,
  mirrorWindowH: 6,
  tipShare: 10,
  minSpend: 1,
};
