import { BRAND } from "@/config/brand";
import { LIMITS } from "@/config/lanes";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/copy-trading",
  title: `Copy Trading With Limits | ${BRAND.name}`,
  description: `Follow a trading desk on ${BRAND.name} and copy its ideas from your own wallet, with a review delay, daily caps, position caps and a stop you set yourself.`,
});

const FLOW = [
  ["A desk posts an idea", "Any wallet can act as a desk. An idea names a market, buy or sell, and a weight from 1% to 100%. The live price is stored with it by the server."],
  ["Your review delay runs", `Up to ${LIMITS.maxReviewDelayH} hours, chosen by you. During it the idea sits in your inbox and you can skip it for good.`],
  ["The copy window opens", `For ${LIMITS.mirrorWindowH} hours you can copy it with one Jupiter swap you sign. After that the idea expires for your wallet.`],
  ["Your limits decide", "Is the market in your list? Has price run further than your chase limit? Would it pass your daily cap or position cap? Any no, and nothing happens."],
  ["The trade lands in your wallet", "A buy spends your per-idea amount times the weight. A sell sells that share of what you copied from this desk. The swap goes from your wallet to your wallet."],
];

export default function CopyTradingPage() {
  return (
    <main>
      <PageHead
        tag="Copy trading"
        fade="Learn from a desk."
        ink="Keep your own rules."
        lead="Following a trader should not mean handing them your account. On OSCRA you follow a wallet's ideas, and every copy passes through limits that only you can set or change."
      >
        <Cta href="/app/copy">Follow a desk</Cta>
        <Cta href="/features" kind="ghost">
          All features
        </Cta>
      </PageHead>

      <section className="shell py-12">
        <Headline fade="From idea to fill," ink="in five checks." />
        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-5">
          {FLOW.map(([t, b], i) => (
            <li key={t} className={`rounded-[20px] p-5 ${i === 3 ? "bg-night text-night-ink" : "card"}`}>
              <span className={`num text-[12px] ${i === 3 ? "text-lime" : "text-mute"}`}>Step {i + 1}</span>
              <h2 className="mt-4 text-[16px] font-semibold">{t}</h2>
              <p className={`mt-2 text-[13.5px] ${i === 3 ? "text-night-mute" : "text-mute"}`}>{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-2">
        <div>
          <Headline fade="Limits that belong" ink="to the follower." />
          <p className="lead mt-6">
            The desk never sees your settings and cannot change them. They are signed by your wallet, stored with your follow, and checked before every copy is built.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Per idea", "The most one buy idea can spend at full weight."],
            ["Daily cap", "Total a desk's ideas may spend from your wallet in a day."],
            ["Position cap", "Most you will hold in one market from one desk, by cost."],
            ["Chase limit", "Skip a copy when price has moved past the desk's price by more than this."],
            ["Stop", "End the follow when what you copied is down this far from its cost."],
            ["Markets", "Only the lanes you tick are ever copied."],
          ].map(([k, v]) => (
            <div key={k} className="card-soft p-4">
              <dt className="text-[14px] font-semibold">{k}</dt>
              <dd className="mt-1 text-[13px] text-mute">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="shell py-12">
        <div className="card p-6 sm:p-10">
          <h2 className="headline">
            <span className="fade">No leaderboard.</span> No invented track records.
          </h2>
          <p className="lead mt-5 max-w-[64ch]">
            Desks on {BRAND.name} start with no history, and the site does not rank them by returns it cannot verify. Every idea is public on this site with its posting price, so a record can be built from
            real data over time. Until then, start small and let your caps do their job.
          </p>
        </div>
      </section>
    </main>
  );
}
