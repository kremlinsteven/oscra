import { BRAND } from "@/config/brand";
import { LANES, LIMITS } from "@/config/lanes";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { PlanCard } from "@/components/home/PlanCard";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/dca-bots",
  title: `DCA Bots on Robinhood Chain | ${BRAND.name}`,
  description: `${BRAND.name} DCA bots buy ETH or stock tokens on a fixed schedule from your own wallet, with price ceilings, drawdown pauses and budgets enforced on-chain.`,
});

const SETTINGS: [string, string, string][] = [
  ["Market", "One of the lanes", `${LANES.map((l) => l.symbol).join(", ")}. Each buys through its deepest USDG pool on Uniswap v3.`],
  ["Order size", `From ${LIMITS.minSpend} USDG`, "Dollars per buy. The last buy shrinks to fit what is left of the budget."],
  ["Pace", `${LIMITS.minIntervalH} hour to ${LIMITS.maxIntervalD} days`, "The next buy opens this long after the last one ran."],
  ["Budget", "Your total", "When the plan has spent it, it stops by itself. Raise it later to continue."],
  ["Price ceiling", "Optional", "While the feed price is above it, buys wait instead of filling."],
  ["Slippage limit", `${LIMITS.minSlipBps / 100}% to ${LIMITS.maxSlipBps / 100}%`, "The swap must return at least the feed-implied amount minus this, or it reverts."],
  ["Drawdown guard", "Optional", "Pauses the plan when price is this far under your average entry, so you decide whether to keep buying."],
  ["Target pause", "Optional", "Pauses the plan when price is this far over your average entry."],
  ["Keeper tip", `Up to 1/${LIMITS.tipShare} of an order`, "Paid only when someone other than you runs a due buy. Zero is fine if you run them yourself."],
  ["Start time", "Now or later", "Delay the first buy by up to ninety days."],
];

export default function DcaBotsPage() {
  return (
    <main>
      <PageHead
        tag="DCA bots"
        fade="Every dip"
        ink="already has a plan."
        lead="A plan buys the same dollar amount of one market at a steady pace. You write the size, the pace, the budget and the conditions once; the Runbook contract checks them before every single buy."
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
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3.5 font-medium">Setting</th>
                <th className="px-5 py-3.5 font-medium">Range</th>
                <th className="px-5 py-3.5 font-medium">What it does</th>
              </tr>
            </thead>
            <tbody>
              {SETTINGS.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-semibold">{a}</td>
                  <td className="num px-5 py-3.5 text-ink-2">{b}</td>
                  <td className="px-5 py-3.5 text-mute">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="shell grid grid-cols-1 gap-4 py-12 md:grid-cols-3">
        {[
          ["Your wallet pays, your wallet receives", "Each buy pulls one order of USDG from your wallet through the allowance you set, swaps it, and the router sends the asset to your address. The contract ends every transaction holding nothing."],
          ["Paused means paused", "A guard or target pause stops the plan until you resume it. Holding a plan yourself works the same way. Closing it is final."],
          ["Who presses the button", "A due buy runs when someone calls it: you from the workspace, or any keeper bot that wants the tip. No OSCRA keeper runs yet; practice mode lets you try the whole cycle first."],
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
