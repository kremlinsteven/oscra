import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Minus, X } from "lucide-react";
import { BRAND } from "@/config/brand";
import { LANES, RUNBOOK_TERMS } from "@/config/lanes";
import { Cta, Headline, Note } from "@/components/site/Blocks";
import { LivePanel } from "@/components/home/LivePanel";
import { ReviewPanel } from "@/components/home/ReviewPanel";
import { PlanCard } from "@/components/home/PlanCard";
import { CoreRail } from "@/components/home/CoreRail";
import { JsonLd } from "@/components/JsonLd";
import { appLd } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const PILLARS = [
  {
    n: "01",
    title: "Review before you commit",
    body: "Pick a market and receive a read built from live prices: trend, the level where the idea is wrong, momentum, room overhead and swing size. Every line shows the number behind it.",
    href: "/ai-review",
  },
  {
    n: "02",
    title: "Recurring buys on your terms",
    body: "Set an order size, a pace and a budget once. Add a price ceiling, a drawdown pause and a target pause. The contract checks all of it before each buy and stops when a rule says stop.",
    href: "/dca-bots",
  },
  {
    n: "03",
    title: "Copy a desk, keep your limits",
    body: "Follow a wallet that publishes trade ideas. Your copy waits through a review delay you choose, skips ideas you veto, and never spends past your daily and position caps.",
    href: "/copy-trading",
  },
];

const COMPARE: [string, string, string, string][] = [
  ["Who holds the money", "You", "The platform", "You: your wallet, the whole time"],
  ["Automation", "None", "Yes, out of sight", "Yes, every rule on screen"],
  ["Risk rules", "In your head", "Unknown to you", "Written down and enforced on-chain"],
  ["What you watch", "Charts all day", "Nothing, until it goes wrong", "A status line per plan and per follow"],
  ["How to stop it", "Close the tab", "Ask support", "Pause the plan, or revoke one allowance"],
];

export default function HomePage() {
  return (
    <main>
      <JsonLd data={appLd} />
      {/* Hero: statement on the left, the live instrument on the right. */}
      <section className="shell grid grid-cols-1 gap-12 pt-14 pb-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:pt-24">
        <div>
          <span className="tag">{BRAND.name} · Non-custodial trading workspace</span>
          <h1 className="display mt-6">
            <span className="fade">Automate with control.</span> Trade with confidence.
          </h1>
          <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">{BRAND.name}</strong> runs recurring buys and copied trades straight from your own wallet on {BRAND.chainName}, checks every order
            against a live price feed, and shows you the read and the limits before anything moves. Your assets never leave your wallet to sit with us.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/app">Open the workspace</Cta>
            <Cta href="/features" kind="ghost">
              See how it works
            </Cta>
          </div>
          <dl className="mt-10 grid max-w-[560px] grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
            {[
              ["Markets", `${LANES.length} lanes`],
              ["Custody", "Your wallet"],
              ["Admin key", "None"],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3">
                <dt className="label">{k}</dt>
                <dd className="mt-1 text-[15px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <LivePanel />
      </section>

      {/* One workspace, three ways in. */}
      <section className="shell py-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end">
          <Headline fade="Review, schedule and copy" ink="from one trading workspace." />
          <p className="lead">
            Three tools share one rulebook. The review explains a market before you act; recurring buys spend on a plan; copied trades follow someone else&apos;s ideas inside your own caps. All three
            show their status in the same place.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <Link key={p.n} href={p.href} className="card group flex flex-col p-6 transition-colors hover:border-line-2">
              <span className="num text-[12px] text-mute">[{p.n}]</span>
              <h3 className="subhead mt-6">{p.title}</h3>
              <p className="mt-3 text-[14.5px] text-mute">{p.body}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-6 text-[13px] font-semibold text-olive">
                Read more <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* The review. */}
      <section className="bg-card-2 py-20">
        <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <span className="tag">Trade review</span>
            <Headline fade="Read the market." ink="Then decide what to risk." className="mt-6" />
            <p className="lead mt-6">
              The review turns price history into five plain checks and a short summary. It names the price where a buy idea stops making sense, so you can size the position from that distance
              instead of from a feeling. Nothing is sent from this screen; it only informs the plan you write next.
            </p>
            <ul className="mt-8 space-y-3 text-[14.5px] text-ink-2">
              {[
                "Trend from two moving averages, with the gap in percent",
                "Invalidation at the lowest close of the last twenty points",
                "Momentum from a fourteen-period RSI",
                "Room to the recent high and the typical swing per period",
                "Position size from your account, your risk rule and the stop distance",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lime ring-2 ring-lime-soft" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/app/review">Run a review</Cta>
              <Cta href="/ai-review" kind="ghost">
                How the review works
              </Cta>
            </div>
          </div>
          <div className="min-w-0">
            <ReviewPanel lane={0} />
            <Note>The panel above is live: ETH from OKX four-hour candles, refreshed every five minutes.</Note>
          </div>
        </div>
      </section>

      {/* Recurring buys. */}
      <section className="shell grid grid-cols-1 gap-12 py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="order-2 min-w-0 lg:order-1">
          <PlanCard />
        </div>
        <div className="order-1 lg:order-2">
          <span className="tag">Recurring buys</span>
          <Headline fade="Build a position" ink="on a schedule you wrote." className="mt-6" />
          <p className="lead mt-6">
            A plan buys a fixed dollar amount of one market at a fixed pace until its budget is spent. Before each buy the contract reads Chainlink, refuses a price above your ceiling, and pauses the
            plan when the price falls too far under your average or rises past your target. You see why it paused and decide whether to resume.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
            {[
              ["Order", "from 1 USDG"],
              ["Pace", "1 h to 90 d"],
              ["Slippage", "0.5% to 5%"],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3">
                <dt className="label">{k}</dt>
                <dd className="num mt-1 text-[14px]">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/app/dca">Write a plan</Cta>
            <Cta href="/dca-bots" kind="ghost">
              Every setting explained
            </Cta>
          </div>
        </div>
      </section>

      {/* The core. */}
      <section className="py-20">
        <div className="shell">
          <Headline fade="One rulebook between your wallet" ink="and every order it sends." />
          <p className="lead mt-6 max-w-[64ch]">
            Reviews, plans and follows all end at the same contract, the OscraRunbook. It holds no balance, has no owner and cannot be upgraded. Anyone may trigger a due buy, but only your rules
            decide whether it happens and how much it spends.
          </p>
        </div>
        <div className="shell mt-12">
          <CoreRail />
        </div>
      </section>

      {/* Capabilities. */}
      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Headline fade="Connect the data, the rules" ink="and the trades you take." />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            ["Live market data", "Prices come from Chainlink feeds on Robinhood Chain, the same numbers the contract checks. The review adds OKX candles for ETH."],
            ["Rules that run on-chain", "Ceilings, pauses, caps and review delays are stored in the contract with your plan or follow, not in a server that could change them."],
            ["One status per position", "Each plan and each follow carries a single state: active, held by you, paused by a guard, at target, spent or closed."],
          ].map(([t, b]) => (
            <div key={t} className="border-t border-line-2 pt-5">
              <h3 className="subhead">{t}</h3>
              <p className="mt-3 text-[14.5px] text-mute">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Custody. */}
      <section className="shell py-16">
        <div className="panel grid grid-cols-1 gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <span className="tag border-white/15 bg-white/5 text-night-mute">Custody</span>
            <h2 className="mt-6 text-[clamp(30px,4vw,50px)] leading-[1.05] font-medium tracking-[-0.034em] text-night-ink">
              <span className="text-night-mute">Grant an allowance.</span> Never hand over the funds.
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-night-mute">
              You approve the Runbook to spend USDG from your wallet. Each buy pulls exactly one order, swaps it on a fixed Uniswap pool and sends the asset straight back to your address in the same
              transaction. Lower the allowance to zero and every plan and follow stops at once. Exchange account connections are not part of this release.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/connect-guide" className="btn btn-lime">
                Read the permissions guide <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["0", "USDG the Runbook keeps between buys", "Checked by the invariant tests after every random sequence of plans, buys, follows and copies."],
              ["None", "Owner or admin key", "No pause switch, no fee setter, no upgrade path. Settings are fixed at deployment."],
              [`${LANES.length}`, "Markets, fixed for good", "ETH and nine official stock tokens, each matched to its Chainlink feed and deepest USDG pool."],
              ["Every order", "Checked against the feed", "The swap must return at least the feed price minus your slippage limit, or it reverts."],
            ].map(([n, k, b]) => (
              <div key={k} className="rounded-[18px] border border-night-line bg-night-2 p-5">
                <p className="text-[34px] leading-none font-medium tracking-[-0.03em] text-lime">{n}</p>
                <p className="mt-3 text-[13.5px] font-semibold text-night-ink">{k}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-night-mute">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison. */}
      <section className="shell py-16">
        <div className="max-w-[760px]">
          <span className="tag">Why {BRAND.name}</span>
          <Headline fade="Limits on screen before automation." ink="Not explained after the fact." className="mt-6" />
          <p className="lead mt-6">
            Trading by hand costs your evenings. Handing money to a bot you cannot inspect costs your sleep. {BRAND.name} sits between the two: automation you can read, on money that stays in your
            name.
          </p>
        </div>
        <div className="scroll-x mt-10 rounded-[20px] border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-mute">
                <th className="px-5 py-4 font-medium">Question</th>
                <th className="px-5 py-4 font-medium">Trading by hand</th>
                <th className="px-5 py-4 font-medium">Closed bots</th>
                <th className="bg-lime-soft px-5 py-4 font-semibold text-ink">{BRAND.name}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([q, a, b, c]) => (
                <tr key={q} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-medium">{q}</td>
                  <td className="px-5 py-3.5 text-mute">
                    <span className="inline-flex items-center gap-2">
                      <Minus size={14} className="shrink-0 text-faint" />
                      {a}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-mute">
                    <span className="inline-flex items-center gap-2">
                      <X size={14} className="shrink-0 text-bad" />
                      {b}
                    </span>
                  </td>
                  <td className="bg-lime-soft/60 px-5 py-3.5">
                    <span className="inline-flex items-center gap-2">
                      <Check size={14} className="shrink-0 text-olive" />
                      {c}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* A due buy, step by step. */}
      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <span className="tag">Inside one order</span>
          <Headline fade="What happens" ink="when a buy comes due." className="mt-6" />
        </div>
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[
            ["The call", "Someone calls the Runbook for your plan: you from the workspace, or a keeper that collects the small tip you allowed. Calling early does nothing but fail; the contract compares the clock with your next buy time."],
            ["The checks", "The contract reads the Chainlink price for the market and refuses a stale one. It compares the price with your ceiling, your average entry, your drawdown guard and your target, and pauses the plan instead of buying when one of them says so."],
            ["The swap", "Exactly one order of USDG moves from your wallet to the Uniswap pool for that market. The minimum it must receive is set from the feed price minus your slippage limit, so a poor pool price makes the whole transaction revert."],
            ["The result", "The asset arrives at your own address, the plan records what it spent and what it bought, and your average entry updates. The contract finishes holding nothing, and the next buy opens one interval later."],
          ].map(([t, b], i) => (
            <li key={t} className="border-t border-line-2 pt-5">
              <span className="num text-[12px] text-mute">0{i + 1}</span>
              <h3 className="subhead mt-2">{t}</h3>
              <p className="mt-2 text-[14.5px] text-mute">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it is for. */}
      <section className="shell grid grid-cols-1 gap-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Active traders", "Keep a review step and a schedule without giving up custody."],
          ["Followers", "Learn from a desk while your own caps decide how much each idea may spend."],
          ["Busy people", "Write the plan once; check one status line instead of a chart."],
          ["Careful savers", "Every limit is visible, and one allowance switch stops everything."],
        ].map(([t, b]) => (
          <div key={t} className="card-soft p-5">
            <h3 className="text-[15px] font-semibold">{t}</h3>
            <p className="mt-2 text-[13.5px] text-mute">{b}</p>
          </div>
        ))}
      </section>

      {/* Fees. */}
      <section className="shell py-16">
        <div className="grid grid-cols-1 gap-8 rounded-[24px] border border-line bg-card p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <span className="tag">Pricing</span>
            <h2 className="headline mt-6">
              <span className="fade">No subscription.</span> A fee per order, shared with stakers.
            </h2>
            <p className="lead mt-6">
              Until {BRAND.symbol} launches, orders run with no protocol fee at all. Afterwards each order pays {RUNBOOK_TERMS.feeBps / 100}% of its size, wallets that hold or stake enough{" "}
              {BRAND.symbol} pay {RUNBOOK_TERMS.holderFeeBps / 100}%, and every fee goes to the staking contract for {BRAND.symbol} stakers.
            </p>
            <div className="mt-8">
              <Cta href="/pricing" kind="ghost">
                Fee details
              </Cta>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Before launch", "0%"],
              ["Standard", `${RUNBOOK_TERMS.feeBps / 100}%`],
              ["Holders", `${RUNBOOK_TERMS.holderFeeBps / 100}%`],
            ].map(([k, v], i) => (
              <div key={k} className={`rounded-[18px] p-4 ${i === 2 ? "bg-lime" : "bg-card-2"}`}>
                <p className="label text-ink-2">{k}</p>
                <p className="num mt-3 text-[28px] tracking-[-0.03em]">{v}</p>
                <p className="mt-1 text-[11.5px] text-ink-2">per order</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call. */}
      <section className="shell py-20 text-center">
        <span className="tag">Ready when your rules are</span>
        <h2 className="display mx-auto mt-6 max-w-[16ch]">
          <span className="fade">Set the limits first.</span> Review every move.
        </h2>
        <p className="lead mx-auto mt-6 max-w-[52ch]">
          Practice mode runs every screen on live prices without sending a transaction, so you can see how a plan or a follow behaves before any money is involved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Cta href="/app">Open the workspace</Cta>
          <Cta href="/faq" kind="ghost">
            Questions first
          </Cta>
        </div>
        <div className="mx-auto mt-14 grid max-w-[1000px] grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Price read", "Feed checked before the order"],
            ["Ceiling held", "A buy above your cap waits"],
            ["Guard paused a plan", "Price fell past your limit"],
            ["Idea skipped", "You vetoed it in the review window"],
          ].map(([t, b]) => (
            <div key={t} className="card p-4">
              <p className="text-[13.5px] font-semibold">{t}</p>
              <p className="mt-1 text-[12.5px] text-mute">{b}</p>
            </div>
          ))}
        </div>
        <Note>Example events the workspace shows, not a record of real activity.</Note>
      </section>
    </main>
  );
}
