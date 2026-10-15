import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/changelog",
  title: `Changelog | ${BRAND.name}`,
  description: `What changed in ${BRAND.name}: the first workspace release with trade review, recurring buys, copy desks, practice mode and the Runbook and Keel contracts.`,
});

export default function ChangelogPage() {
  return (
    <ProsePage tag="Changelog" fade="What changed," ink="newest first.">
      <h2>15 Oct 2026 · First release</h2>
      <ul>
        <li>Workspace with overview, recurring buys, copy desks, trade review and staking screens.</li>
        <li>Practice mode on live Chainlink prices, following the contract&apos;s rules.</li>
        <li>OscraRunbook and OscraKeel contracts written and tested (unit, fuzz, invariant and mainnet-fork tests). Deployment pending.</li>
        <li>Rule-based trade review for ten markets from OKX candles and Chainlink rounds.</li>
      </ul>
      <h2>Next</h2>
      <ul>
        <li>Runbook deployment, then the {BRAND.symbol} launch, the Keel and the one-time bind.</li>
        <li>An optional keeper so due buys run without anyone pressing the button.</li>
        <li>An assistant-written summary on top of the review numbers.</li>
      </ul>
    </ProsePage>
  );
}
