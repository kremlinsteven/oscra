import { BRAND, CHAIN, SWAP_ROUTER, USDG, explorerAddress } from "@/config/brand";
import { CONTRACTS, keelLive, runbookLive } from "@/config/contracts";
import { KEEL_TERMS, LANES, LIMITS, RUNBOOK_TERMS } from "@/config/lanes";
import { Headline, PageHead } from "@/components/site/Blocks";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/contracts",
  title: `Contracts | ${BRAND.name}`,
  description: `The ${BRAND.name} smart contracts on Robinhood Chain: OscraRunbook for plans and copies, OscraKeel for staking, with functions, events and addresses.`,
});

const RUNBOOK_FNS: [string, string][] = [
  ["openPlan(terms) / tunePlan(id, terms)", "Write or change a plan: lane, order size, pace, budget, ceiling, slippage, guard, target, tip, start."],
  ["holdPlan / resumePlan / closePlan(id)", "Owner-only state changes."],
  ["runPlan(id)", "Anyone may call when due. Checks feed age, ceiling, guard and target, pulls one order, swaps, delivers to the owner."],
  ["post(lane, sell, weightBps)", "Publish an idea as a desk; the feed price is stored with it."],
  ["follow(desk, terms) / unfollow(desk)", "Start or change a follow with your limits; only later ideas count."],
  ["skip(signalId)", "Veto one idea for your wallet."],
  ["mirror(follower, signalId)", "Anyone may call inside the follower's copy window. Applies every follower limit, then buys or sells."],
  ["bind(keel)", "One call, once, by the deploying wallet: links the staking contract and switches fees on."],
];
const KEEL_FNS: [string, string][] = [
  ["stake(amount) / unstake(amount)", `Stake ${BRAND.symbol}; unstaking waits while a poll you voted in is open.`],
  ["pour() / claim()", "Count newly arrived USDG fees / pay out your share."],
  ["openPoll(title, choices, duration)", `Needs ${Number(KEEL_TERMS.proposerMin / 10n ** 18n).toLocaleString("en-US")} ${BRAND.symbol} staked; 2 to 6 choices, 1 to 14 days.`],
  ["vote(id, choice)", "Weight = your stake; locks it until the poll ends."],
];

function Addr({ v }: { v: string }) {
  return v ? (
    <a href={explorerAddress(v)} target="_blank" rel="noreferrer" className="font-mono break-all underline">
      {v}
    </a>
  ) : (
    <span className="text-mute">not deployed yet</span>
  );
}

export default function ContractsPage() {
  return (
    <main>
      <PageHead
        tag="Developers"
        fade="Two contracts."
        ink="No owner, no upgrade, no hidden switch."
        lead={`Everything ${BRAND.name} does on-chain lives in OscraRunbook and OscraKeel on ${CHAIN.name} (chain ${CHAIN.id}). Settings are constructor values; nothing can change them after deployment.`}
      />
      <section className="shell grid grid-cols-1 gap-4 py-6 md:grid-cols-2">
        <div className="card p-6 text-[14px]">
          <p className="label">OscraRunbook</p>
          <p className="mt-2">
            <Addr v={runbookLive() ? CONTRACTS.runbook : ""} />
          </p>
          <p className="mt-3 text-mute">Needs no token. Fee {RUNBOOK_TERMS.feeBps} bps, holders {RUNBOOK_TERMS.holderFeeBps} bps, zero until bound.</p>
        </div>
        <div className="card p-6 text-[14px]">
          <p className="label">OscraKeel</p>
          <p className="mt-2">
            <Addr v={keelLive() ? CONTRACTS.keel : ""} />
          </p>
          <p className="mt-3 text-mute">Deployed after {BRAND.symbol} launches (its address is a constructor value).</p>
        </div>
      </section>
      <section className="shell py-12">
        <Headline fade="OscraRunbook" ink="functions." />
        <dl className="mt-8 divide-y divide-line rounded-[20px] border border-line bg-card">
          {RUNBOOK_FNS.map(([f, d]) => (
            <div key={f} className="grid grid-cols-1 gap-1 px-5 py-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6">
              <dt className="font-mono text-[13px] break-words">{f}</dt>
              <dd className="text-[14px] text-mute">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13.5px] text-ink-2">
          Events: PlanOpened, PlanTuned, PlanStateChanged, Bought, Posted, Followed, Unfollowed, FollowStopped, Skipped, Mirrored, Bound. Limits: pace {LIMITS.minIntervalH} h to {LIMITS.maxIntervalD} d,
          slippage {LIMITS.minSlipBps / 100}% to {LIMITS.maxSlipBps / 100}%, review delay up to {LIMITS.maxReviewDelayH} h, copy window {LIMITS.mirrorWindowH} h, tip up to 1/{LIMITS.tipShare} of an order.
        </p>
      </section>
      <section className="shell py-12">
        <Headline fade="OscraKeel" ink="functions." />
        <dl className="mt-8 divide-y divide-line rounded-[20px] border border-line bg-card">
          {KEEL_FNS.map(([f, d]) => (
            <div key={f} className="grid grid-cols-1 gap-1 px-5 py-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6">
              <dt className="font-mono text-[13px] break-words">{f}</dt>
              <dd className="text-[14px] text-mute">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13.5px] text-ink-2">Events: Staked, Unstaked, Poured, Claimed, PollOpened, Voted.</p>
      </section>
      <section className="shell py-12">
        <Headline fade="Lanes" ink="fixed at deployment." />
        <div className="scroll-x mt-8 rounded-[20px] border border-line bg-card">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Market</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Chainlink feed</th>
                <th className="px-4 py-3 font-medium">Pool fee</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2.5">{l.id}</td>
                  <td className="px-4 py-2.5 font-semibold">{l.symbol}</td>
                  <td className="px-4 py-2.5">
                    <Addr v={l.asset} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Addr v={l.feed} />
                  </td>
                  <td className="num px-4 py-2.5">{l.poolFee / 10_000}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13.5px] text-ink-2">
          Swaps go through Uniswap v3 SwapRouter02 <Addr v={SWAP_ROUTER} /> against USDG <Addr v={USDG.address} />. Each deployment can be checked against this build with{" "}
          <code className="font-mono">npm run verify-deployment</code>, which compares runtime code, every immutable, the stored lanes and the exact constructor input.
        </p>
      </section>
    </main>
  );
}
