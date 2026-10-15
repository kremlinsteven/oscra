import { BRAND } from "@/config/brand";
import { LANES, PRACTICE_TERMS, RECURRING } from "@/config/lanes";

export const FAQ: { q: string; a: string }[] = [
  {
    q: `What is ${BRAND.name}?`,
    a: `${BRAND.name} is a non-custodial workspace for trading automation on Solana. It runs recurring buys and copied trades from your own wallet under limits you write, and gives you a rule-based review of a market before you commit.`,
  },
  {
    q: `How does ${BRAND.name} work?`,
    a: `Recurring buys are Jupiter Recurring orders your wallet signs: the USDC sits in an order account only you can cancel, and Jupiter fills it on schedule inside your price range. Copied trades are Jupiter swaps: when a desk you follow posts an idea, ${BRAND.name} checks your limits and builds the swap, and your wallet decides.`,
  },
  {
    q: `Does ${BRAND.name} ever hold my money?`,
    a: `No. ${BRAND.name} has no smart contract, no vault and no server wallet. Real orders live in Jupiter accounts tied to your wallet; cancelling a recurring order returns the unspent USDC and everything bought.`,
  },
  {
    q: "Which markets can I buy?",
    a: `${LANES.map((l) => l.symbol).join(", ")}: SOL and nine xStocks tokenized shares on Solana, matched by mint (never by ticker), priced by Pyth or Jupiter and bought with USDC.`,
  },
  {
    q: `Which network is ${BRAND.name} on?`,
    a: "Solana mainnet. Any Wallet Standard wallet works: Phantom, Solflare, Backpack and others are detected automatically.",
  },
  {
    q: "Can I connect my Binance, Coinbase or OKX account?",
    a: `Not in this release. ${BRAND.name} works with a self-custody Solana wallet. If exchange connections are added later, keys would stay in your browser and never reach our servers; until then the site asks for none.`,
  },
  {
    q: "Is the trade review written by AI?",
    a: "Today it is a fixed set of rules applied to live price data, so every line can be checked against a number. A summary from an AI assistant is planned and will build on the same numbers.",
  },
  {
    q: "Who runs my due buys?",
    a: "Jupiter does. Once your recurring order is created, Jupiter's own keepers fill each order on schedule; you do not need to keep the site open. Copied trades are different: each one waits for your signature.",
  },
  {
    q: "What does it cost?",
    a: `${BRAND.name} charges nothing on real orders. Jupiter keeps ${RECURRING.jupiterFeeBps / 100}% of each filled recurring order, and every transaction pays a small Solana fee. The ${BRAND.symbol} fee share (${PRACTICE_TERMS.feeBps / 100}% / ${PRACTICE_TERMS.holderFeeBps / 100}%) runs as practice only.`,
  },
  {
    q: `How do I buy ${BRAND.symbol}?`,
    a: `${BRAND.symbol} launches on pump.fun, on Solana. Use only the mint address published on the token page of this site and on X ${BRAND.xHandle}.`,
  },
  {
    q: "What is practice mode?",
    a: "Every workspace screen running on live prices with a simulated wallet stored in your browser. It adds rules real orders do not have (drawdown guard, target pause, practice staking) so you can see how plans and follows behave before real money is involved.",
  },
];
