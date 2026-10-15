import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/risk",
  title: `Risk Disclosure | ${BRAND.name}`,
  description: `The risks of using ${BRAND.name}: market moves, third-party protocol risk, price and route risk, xStocks issuer controls and copy timing.`,
});

export default function RiskPage() {
  return (
    <ProsePage tag="Legal" fade="Risk" ink="disclosure." updated="16 Oct 2026">
      <p>Trading digital assets can lose money, including all of it. Read these points before you sign anything.</p>
      <h2>Market risk</h2>
      <p>Buying on a schedule spreads entries over time; it does not prevent losses. A price range only makes orders wait. Prices can move a long way between two orders.</p>
      <h2>Third-party protocol risk</h2>
      <p>
        Real orders use Jupiter&apos;s Recurring program and swap routes on Solana. {BRAND.name} does not run or control them. A fault or outage there can delay, fail or misprice an order; a recurring
        order&apos;s funds sit in Jupiter&apos;s order account until filled or cancelled.
      </p>
      <h2>Price and route risk</h2>
      <p>
        Prices shown come from Pyth when its on-chain feed is fresh and from Jupiter otherwise. A swap fills at the route Jupiter finds, bounded by your slippage limit; thin markets cost more. USDC is treated as
        one dollar.
      </p>
      <h2>xStocks risk</h2>
      <p>xStocks are tokenized shares issued by a third party as Token-2022 mints. The issuer can pause transfers and holds a permanent delegate, which can make a buy or a sell fail or move tokens.</p>
      <h2>Copy risk</h2>
      <p>A desk can post poor or hostile ideas. Your caps, chase limit, review delay and stop limit the damage; they do not remove it. Copies run only when you sign them, so a missed window means a missed copy.</p>
      <h2>Records</h2>
      <p>Follows, ideas and votes are stored by {BRAND.name}&apos;s server. If that storage is lost they can disappear; they never hold funds.</p>
      <h2>Token and practice</h2>
      <p>{BRAND.symbol} can lose value. Staking, fee share and the holder discount are practice only: they move no funds and pay nothing.</p>
    </ProsePage>
  );
}
