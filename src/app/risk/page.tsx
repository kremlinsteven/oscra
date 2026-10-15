import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/risk",
  title: `Risk Disclosure | ${BRAND.name}`,
  description: `The risks of using ${BRAND.name}: market moves, smart contract risk, oracle and pool risk, stock-token issuer controls and keeper timing.`,
});

export default function RiskPage() {
  return (
    <ProsePage tag="Legal" fade="Risk" ink="disclosure." updated="15 Oct 2026">
      <p>Trading digital assets can lose money, including all of it. Read these points before you approve anything.</p>
      <h2>Market risk</h2>
      <p>Buying on a schedule spreads entries over time; it does not prevent losses. A drawdown guard pauses buying, it does not sell. Prices can move past any level between two blocks.</p>
      <h2>Smart contract risk</h2>
      <p>The OSCRA contracts are tested but can still contain mistakes. They have no admin key, which also means nobody can pause or repair them after deployment.</p>
      <h2>Price feed and pool risk</h2>
      <p>
        Orders are checked against Chainlink feeds. Stock feeds update less often outside market hours; a buy is refused when its feed is older than the lane allows. A thin or moved pool makes orders
        revert at your slippage limit. USDG is treated as one dollar.
      </p>
      <h2>Stock token risk</h2>
      <p>Robinhood stock tokens are issued by Robinhood. The issuer can pause transfers or block addresses, which can make a buy or a sell fail.</p>
      <h2>Copy risk</h2>
      <p>A desk can post poor or hostile ideas. Your caps, chase limit, review delay and stop limit the damage; they do not remove it.</p>
      <h2>Timing</h2>
      <p>A due buy runs only when someone calls it. If nobody does, it waits. Copy windows expire after six hours.</p>
      <h2>Token</h2>
      <p>{BRAND.symbol} can lose value. Fee share depends on real trading through the Runbook and can be zero.</p>
    </ProsePage>
  );
}
