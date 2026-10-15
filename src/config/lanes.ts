/*
 * The markets ("lanes") OSCRA buys with USDC on Solana. Each asset is identified by its MINT, never by ticker:
 * wrapped SOL and the xStocks tokenized shares (Token-2022 mints issued by one issuer, each read on-chain on
 * 16 Oct 2026: metadata name "<Company> xStock", 8 decimals). Prices come from Pyth (the matching
 * "<SYMBOL>X/USD" feed prices the token itself and trades around the clock) with the Jupiter price API as the
 * live fallback, since only some Pyth feeds are pushed on-chain continuously.
 *
 * Issuer powers worth knowing: xStocks mints carry a permanent delegate, a pause switch and a scaled UI amount
 * (dividends raise the multiplier). OSCRA never holds them; they stay in your wallet.
 */

export type LaneKind = "crypto" | "stock";

export type Lane = {
  id: number;
  symbol: string;
  name: string;
  kind: LaneKind;
  /** SPL mint on Solana. */
  mint: string;
  /** Pyth price feed id (hex, no 0x). */
  feedId: string;
  decimals: number;
  token2022: boolean;
};

export const LANES: Lane[] = [
  { id: 0, symbol: "SOL", name: "Solana (wrapped SOL)", kind: "crypto", mint: "So11111111111111111111111111111111111111112", feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", decimals: 9, token2022: false },
  { id: 1, symbol: "NVDAx", name: "NVIDIA xStock", kind: "stock", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", feedId: "4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f", decimals: 8, token2022: true },
  { id: 2, symbol: "SPYx", name: "SP500 xStock", kind: "stock", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", feedId: "2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14", decimals: 8, token2022: true },
  { id: 3, symbol: "QQQx", name: "Nasdaq xStock", kind: "stock", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", feedId: "178a6f73a5aede9d0d682e86b0047c9f333ed0efe5c6537ca937565219c4054d", decimals: 8, token2022: true },
  { id: 4, symbol: "AAPLx", name: "Apple xStock", kind: "stock", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", feedId: "978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675", decimals: 8, token2022: true },
  { id: 5, symbol: "GOOGLx", name: "Alphabet xStock", kind: "stock", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", feedId: "b911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e", decimals: 8, token2022: true },
  { id: 6, symbol: "TSLAx", name: "Tesla xStock", kind: "stock", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", feedId: "47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362", decimals: 8, token2022: true },
  { id: 7, symbol: "MSFTx", name: "Microsoft xStock", kind: "stock", mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", feedId: "bb723a70af731ab56b9a650eb7e8ac22b7bc07ea77f8670bd1fa9a37bf6df3f5", decimals: 8, token2022: true },
  { id: 8, symbol: "AMZNx", name: "Amazon.com xStock", kind: "stock", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", feedId: "7148fbe6e493ff2580305c92a8d7f8628c9943b11b9b253aebc24863fec290e8", decimals: 8, token2022: true },
  { id: 9, symbol: "METAx", name: "Meta xStock", kind: "stock", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", feedId: "bf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900", decimals: 8, token2022: true },
];

export const laneById = (id: number) => LANES.find((l) => l.id === id) ?? null;
export const laneByMint = (mint: string) => LANES.find((l) => l.mint === mint) ?? null;

/** Pyth push oracle program: sponsored feed accounts are PDAs [shard u16 LE, feed id] of it (shard 0). */
export const PYTH_PUSH_PROGRAM = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";
/** A Pyth price older than this is not shown as live; the Jupiter price is used instead. */
export const PYTH_FRESH_SECS = 300;

/**
 * Jupiter Recurring (time-based) rules, enforced by Jupiter and checked here first so the form explains them:
 * at least 2 orders, at least 50 USDC per order (100 USDC total). Jupiter charges its own 0.1% per filled order.
 */
export const RECURRING = {
  minOrders: 2,
  maxOrders: 1_000,
  minPerOrder: 50,
  minIntervalH: 1,
  maxIntervalD: 90,
  jupiterFeeBps: 10,
};

/** Practice fee schedule shown in the staking practice (no OSCRA fee exists on real orders). */
export const PRACTICE_TERMS = {
  feeBps: 20,
  holderFeeBps: 10,
  /** Hold or stake at least this much $OSCRA for the lower practice rate (1,000,000,000 supply). */
  holderMin: 250_000,
  /** Minimum stake to open a poll; votes weigh the $OSCRA balance at vote time. */
  proposerMin: 500_000,
};

/** Limits the app enforces before it builds a copied trade or a practice action. */
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
