import { BRAND } from "@/config/brand";
import { LANES, LIMITS, RECURRING } from "@/config/lanes";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { PlanCard } from "@/components/home/PlanCard";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/dca-bots",
  title: `DCA Bots on Solana | ${BRAND.name}`,
  description: `${BRAND.name} DCA bots buy SOL or xStocks on a fixed schedule from your own wallet through Jupiter Recurring orders, with a price range and a cancel button that returns the rest.`,
});

const SETTINGS: [string, string, string, string][] = [
  ["Market", "One of the lanes", `${LANES.map((l) => l.symbol).join(", ")}. Bought with USDC through Jupiter, matched by mint.`, "Real + practice"],
  ["Per order", `From ${RECURRING.minPerOrder} USDC`, "USDC spent on each buy. Jupiter's minimum for recurring orders.", "Real"],
  ["Number of orders", `${RECURRING.minOrders} or more`, "Total deposit = per order × orders. The order finishes when the last one fills.", "Real"],
  ["Pace", `${LIMITS.minIntervalH} hour to ${LIMITS.maxIntervalD} days`, "Time between two buys.", "Real + practice"],
  ["Price range", "Optional", "Lowest price and ceiling. While the price is outside, buys wait instead of filling.", "Real + practice"],
  ["Start time", "Now or later", "Delay the first buy.", "Real + practice"],
  ["Slippage limit", `${LIMITS.minSlipBps / 100}% to ${LIMITS.maxSlipBps / 100}%`, "How far below the live price a practice fill may land.", "Practice"],
  ["Drawdown guard", "Optional", "Pauses the plan when price is this far under your average entry, so you decide whether to keep buying.", "Practice"],
  ["Target pause", "Optional", "Pauses the plan when price is this far over your average entry.", "Practice"],
  ["Cancel", "Any time", "Returns the unspent USDC and everything bought so far to your wallet.", "Real"],
];

export default function DcaBotsPage() {
  return (
    <main>
      <PageHead
        tag="DCA bots"
        fade="Every dip"
        ink="already has a plan."
        lead="A plan buys the same USDC amount of one market at a steady pace. You write the size, the pace, the number of orders and a price range once; your wallet signs one Jupiter Recurring order and Jupiter fills it on schedule."
        aside={<PlanCard />}
      >
        <Cta href="/app/dca">Write your first plan</Cta>
        <Cta href="/ai-review" kind="ghost">
          Review the market first
        </Cta>
      </PageHead>

      <section className="shell py-16">
        <Headline fade="Ten settings." ink="Each one does exactly one thing." />
        <div className="scroll-x mt-10 rounded-[20px] border border-line bg-card">
          <table className="w-full min-w-[780px] text-left text-[14px]">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3.5 font-medium">Setting</th>
                <th className="px-5 py-3.5 font-medium">Range</th>
                <th className="px-5 py-3.5 font-medium">What it does</th>
                <th className="px-5 py-3.5 font-medium">Where</th>
              </tr>
            </thead>
            <tbody>
              {SETTINGS.map(([a, b, c, d]) => (
                <tr key={a} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-semibold">{a}</td>
                  <td className="num px-5 py-3.5 text-ink-2">{b}</td>
                  <td className="px-5 py-3.5 text-mute">{c}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-ink-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shell grid grid-cols-1 gap-4 py-12 md:grid-cols-3">
        {[
          ["Your wallet pays, your wallet receives", "Creating the plan deposits its USDC into a Jupiter order account only your wallet controls. Each buy lands in your wallet; OSCRA never holds anything."],
          ["Cancel means done", "Cancelling a recurring order returns what it has not spent at once. In practice, a guard or target pause stops the plan until you resume it."],
          ["Who presses the button", "Nobody needs to. Jupiter's keepers fill each due order; you can close the tab. Practice mode lets you try the whole cycle first, on the practice clock."],
        ].map(([t, b]) => (
          <div key={t} className="card p-6">
            <h2 className="subhead">{t}</h2>
            <p className="mt-3 text-[14.5px] text-mute">{b}</p>
          </div>
        ))}
      </section>

      <section className="shell py-12">
        <div className="panel p-6 sm:p-10">
          <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-medium tracking-[-0.03em]">
            <span className="text-night-mute">No backtests, no presets with</span> borrowed returns.
          </h2>
          <p className="mt-5 max-w-[62ch] text-[15.5px] text-night-mute">
            {BRAND.name} does not show simulated profits for its plans. The workspace shows what a plan will do with your settings: how many orders, over how long, at today&apos;s price. Practice mode then
            runs it on live prices so you can watch the rules work.
          </p>
          <div className="mt-8">
            <Cta href="/app/dca" kind="lime">
              Try it in practice
            </Cta>
          </div>
        </div>
      </section>
    </main>
  );
}
