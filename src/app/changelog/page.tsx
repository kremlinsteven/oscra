import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/changelog",
  title: `Changelog | ${BRAND.name}`,
  description: `What changed in ${BRAND.name}: the move to Solana with Jupiter orders and signed records, and the first workspace release.`,
});

export default function ChangelogPage() {
  return (
    <ProsePage tag="Changelog" fade="What changed," ink="newest first.">
      <h2>16 Oct 2026 · Moved to Solana</h2>
      <ul>
        <li>{BRAND.name} now runs on Solana with no program of its own: recurring buys are Jupiter Recurring orders, copied trades are Jupiter swaps, both signed in your wallet.</li>
        <li>Follows, desk ideas, skips, copies and polls are wallet-signed records; copies are checked against the chain before they count.</li>
        <li>Markets: SOL and nine xStocks, matched by mint, priced by Pyth and Jupiter. Reviews read OKX and Solana pool candles.</li>
        <li>{BRAND.symbol} launches on pump.fun. Staking, fee share and the holder discount run as practice; poll votes weigh the {BRAND.symbol} a wallet holds.</li>
      </ul>
      <h2>15 Oct 2026 · First release</h2>
      <ul>
        <li>Workspace with overview, recurring buys, copy desks, trade review and staking screens.</li>
        <li>Practice mode on live prices.</li>
        <li>Rule-based trade review for ten markets.</li>
      </ul>
      <h2>Next</h2>
      <ul>
        <li>An assistant-written summary on top of the review numbers.</li>
        <li>Optional on-chain anchoring of records with the SPL Memo program.</li>
      </ul>
    </ProsePage>
  );
}
