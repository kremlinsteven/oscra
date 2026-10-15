import { BRAND } from "@/config/brand";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { ReviewPanel } from "@/components/home/ReviewPanel";
import { PlanCard } from "@/components/home/PlanCard";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/features",
  title: `Features | ${BRAND.name}`,
  description: `Everything in ${BRAND.name}: trade review from live prices, recurring buys, copy desks with caps, a portfolio view, practice mode and $OSCRA staking.`,
});

const STAGES = [
  ["Review", "Five checks and a stop distance from live prices."],
  ["Your rules", "Size, pace, caps, ceilings and pauses you write."],
  ["Feed check", "Chainlink price read inside the transaction."],
  ["Swap", "One order through a fixed Uniswap v3 pool."],
  ["Your wallet", "The asset arrives at your address. Nothing is kept."],
];

export default function FeaturesPage() {
  return (
    <main>
      <PageHead
        tag="Features"
        fade="Three ways to automate."
        ink="One set of limits over all of them."
        lead={`${BRAND.name} reads the market, buys on a schedule and copies desks you choose. Each of them runs inside rules you set before money moves, and each shows its state in plain words.`}
      >
        <Cta href="/app">Open the workspace</Cta>
      </PageHead>

      <section className="shell py-10">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {STAGES.map(([t, b], i) => (
            <li key={t} className={`rounded-[18px] p-5 ${i === 2 ? "bg-lime" : "card"}`}>
              <span className="num text-[12px] text-ink-2">0{i + 1}</span>
              <h2 className="mt-4 text-[16px] font-semibold">{t}</h2>
              <p className="mt-1.5 text-[13px] text-ink-2">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <span className="tag">Trade review</span>
          <Headline fade="Read the market," ink="then write the trade." className="mt-6" />
          <ul className="mt-6 space-y-2.5 text-[14.5px] text-ink-2">
            <li>Trend, invalidation, momentum, room overhead and swing size per market</li>
            <li>Position size from your account, your risk rule and the stop distance</li>
            <li>One click from a read to a pre-filled plan</li>
          </ul>
          <div className="mt-6">
            <Cta href="/ai-review" kind="ghost">
              Trade review
            </Cta>
          </div>
        </div>
        <ReviewPanel lane={0} compact />
      </section>

      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="order-2 lg:order-1">
          <PlanCard />
        </div>
        <div className="order-1 lg:order-2">
          <span className="tag">Recurring buys</span>
          <Headline fade="Buy the dip" ink="you planned for." className="mt-6" />
          <ul className="mt-6 space-y-2.5 text-[14.5px] text-ink-2">
            <li>Fixed order size and pace, with a budget that ends the plan</li>
            <li>Price ceiling, drawdown guard and target pause</li>
            <li>Hold, resume or close from the workspace at any time</li>
          </ul>
          <div className="mt-6">
            <Cta href="/dca-bots" kind="ghost">
              DCA bots
            </Cta>
          </div>
        </div>
      </section>

      <section className="shell grid grid-cols-1 gap-4 py-16 md:grid-cols-2 lg:grid-cols-4">
        {[
          ["Copy desks", "Follow a wallet's ideas with a review delay, skips, daily and position caps, a chase limit and a stop."],
          ["Portfolio view", "Balances of ETH, USDG and the ten lane tokens, valued at feed prices, with your largest share and your allowance."],
          ["Practice mode", "Every screen on live prices with a simulated wallet, until the contract is deployed or whenever you want to test."],
          [`${BRAND.symbol} staking`, "Fee share in USDG, a lower fee for holders, and advisory polls, once the token is live."],
        ].map(([t, b]) => (
          <div key={t} className="card p-5">
            <h2 className="text-[16px] font-semibold">{t}</h2>
            <p className="mt-2 text-[13.5px] text-mute">{b}</p>
          </div>
        ))}
      </section>

      <section className="shell py-12">
        <div className="panel grid grid-cols-1 gap-6 p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="text-[clamp(26px,3.4vw,40px)] leading-tight font-medium tracking-[-0.03em]">
              <span className="text-night-mute">One allowance</span> stops everything.
            </h2>
            <p className="mt-3 max-w-[56ch] text-[15px] text-night-mute">Set the Runbook&apos;s USDG allowance to zero and no plan or follow can spend another cent. The button sits on your workspace overview.</p>
          </div>
          <Cta href="/connect-guide" kind="lime">
            Permissions guide
          </Cta>
        </div>
      </section>
    </main>
  );
}
