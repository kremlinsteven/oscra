import { BRAND } from "@/config/brand";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { ReviewPanel } from "@/components/home/ReviewPanel";
import { PlanCard } from "@/components/home/PlanCard";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/features",
  title: `Features | ${BRAND.name}`,
  description: `Everything in ${BRAND.name}: trade review from live prices, recurring buys, copy desks with caps, a portfolio view, practice mode, $OSCRA polls and practice staking.`,
});

const STAGES = [
  ["Review", "Five checks and a stop distance from live prices."],
  ["Your rules", "Size, pace, caps, ceilings and pauses you write."],
  ["Limit check", "Window, chase, caps and stop checked before a swap is built."],
  ["Swap", "A Jupiter order or swap your wallet signs."],
  ["Your wallet", "The asset arrives at your address. Nothing is kept."],
];

export default function FeaturesPage() {
  return (
    <main>
      <PageHead
        tag="Features"
        fade="Three tools for automation."
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
          <Headline fade="Read the market," ink="then plan the entry." className="mt-6" />
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
          <Headline fade="Buy weakness" ink="on a plan you wrote." className="mt-6" />
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
          ["Portfolio view", "Balances of USDC and the ten markets, valued at live prices, with your largest share and your open recurring orders."],
          ["Practice mode", "Every screen on live prices with a simulated wallet, one tab away from real mode."],
          [`${BRAND.symbol} polls and practice staking`, "Wallet-signed polls weighted by the token you hold; fee share and holder discount in practice."],
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
              <span className="text-night-mute">No standing approval.</span> Nothing to revoke.
            </h2>
            <p className="mt-3 max-w-[56ch] text-[15px] text-night-mute">Every real action is a transaction you sign at that moment. Cancel a recurring order and its unspent USDC comes back; unfollow a desk and its ideas stop.</p>
          </div>
          <Cta href="/connect-guide" kind="lime">
            Permissions guide
          </Cta>
        </div>
      </section>
    </main>
  );
}
