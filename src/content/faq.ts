import { BRAND } from "@/config/brand";
import { LANES, RUNBOOK_TERMS } from "@/config/lanes";

export const FAQ: { q: string; a: string }[] = [
  {
    q: `What is ${BRAND.name}?`,
    a: `${BRAND.name} is a non-custodial trading workspace on Robinhood Chain. It runs recurring buys and copied trades from your own wallet under limits you write, and gives you a rule-based review of a market before you commit.`,
  },
  {
    q: `How does ${BRAND.name} work?`,
    a: "You approve the OscraRunbook contract to spend USDG from your wallet. Each plan or follow stores your limits in that contract. When a buy is due, anyone may trigger it; the contract checks the Chainlink price and your rules, pulls exactly one order, swaps it on Uniswap and sends the asset to your wallet in the same transaction.",
  },
  {
    q: `Does ${BRAND.name} ever hold my money?`,
    a: "No. The Runbook ends every transaction holding nothing, which the test suite checks after thousands of random actions. It can only use the allowance you gave it; set that to zero and everything stops.",
  },
  {
    q: "Which markets can I buy?",
    a: `${LANES.map((l) => l.symbol).join(", ")}: ETH and nine official Robinhood stock tokens, each priced by its Chainlink feed and traded against USDG on its deepest Uniswap v3 pool.`,
  },
  {
    q: `Which network is ${BRAND.name} on?`,
    a: "Robinhood Chain mainnet, chain id 4663. Connecting a wallet on this site adds the network for you.",
  },
  {
    q: "Can I connect my Binance, Coinbase or OKX account?",
    a: `Not in this release. ${BRAND.name} works with a self-custody wallet on Robinhood Chain. If exchange connections are added later, keys would stay in your browser and never reach our servers; until then the site asks for none.`,
  },
  {
    q: "Is the trade review written by AI?",
    a: "Today it is a fixed set of rules applied to live price data, so every line can be checked against a number. A summary from an AI assistant is planned and will build on the same numbers.",
  },
  {
    q: "Who runs my due buys?",
    a: "Anyone can: you from the workspace, or a keeper bot that collects the tip you set. No OSCRA keeper is running yet, so plan to run buys yourself or set a tip.",
  },
  {
    q: "What does it cost?",
    a: `Nothing until ${BRAND.symbol} launches and the staking contract is linked. After that ${RUNBOOK_TERMS.feeBps / 100}% per order, or ${RUNBOOK_TERMS.holderFeeBps / 100}% for wallets that hold or stake enough ${BRAND.symbol}. Every fee goes to ${BRAND.symbol} stakers.`,
  },
  {
    q: `How do I buy ${BRAND.symbol}?`,
    a: `${BRAND.symbol} launches on Pons, the Robinhood Chain launchpad. Use only the contract address published on the token page of this site and on X ${BRAND.xHandle}.`,
  },
  {
    q: "What is practice mode?",
    a: "Every workspace screen running on live prices with a simulated wallet stored in your browser. It applies the contract's rules, so you can see how plans and follows behave before real money is involved.",
  },
];
