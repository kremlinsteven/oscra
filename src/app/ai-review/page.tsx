import { BRAND } from "@/config/brand";
import { LANES } from "@/config/lanes";
import { Cta, Headline, Note, PageHead } from "@/components/site/Blocks";
import { ReviewPanel } from "@/components/home/ReviewPanel";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/ai-review",
  title: `AI Trade Review | ${BRAND.name}`,
  description: `The ${BRAND.name} trade review reads live prices for Solana markets and lays out trend, invalidation, momentum and sizing before you commit a dollar.`,
});

const QUESTIONS = [
  ["Is the trend with me?", "Price against its 20-period average, and the 20 against the 50. Rising, falling or mixed, with both gaps in percent."],
  ["Where am I wrong?", "The lowest close of the last twenty periods. Below it the buy idea is invalid, and its distance from price becomes your stop."],
  ["Am I chasing?", "A fourteen-period RSI. Above 65 a buy chases strength; under 40 sellers still lead."],
  ["How much room is overhead?", "Distance to the highest close of the last twenty periods, the first level a rally meets."],
  ["How big should this be?", "Account × risk rule ÷ stop distance. The read supplies the stop; you supply the rule."],
];

export default function AiReviewPage() {
  return (
    <main>
      <PageHead
        tag="Trade review"
        fade="Know the stop"
        ink="before you know the size."
        lead={`The ${BRAND.name} review reads a market's recent prices and answers five questions in numbers you can check. It does not place trades and it does not guess: each line is a fixed rule applied to live data.`}
      >
        <Cta href="/app/review">Open the review</Cta>
        <Cta href="/dca-bots" kind="ghost">
          Then schedule it
        </Cta>
      </PageHead>

      <section className="shell grid grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <ReviewPanel lane={1} />
          <Note>Live read for NVDAx, built from four-hour candles of its deepest USDC pool on Solana.</Note>
        </div>
        <div>
          <Headline fade="Five questions" ink="every entry should answer." />
          <ol className="mt-8 space-y-6">
            {QUESTIONS.map(([q, a], i) => (
              <li key={q} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                <span className="num text-[13px] text-mute">0{i + 1}</span>
                <span>
                  <span className="block text-[16px] font-semibold">{q}</span>
                  <span className="mt-1 block text-[14.5px] text-mute">{a}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell py-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["From the read to a plan", "The sizing box turns the stop distance and your risk rule into a position size, then splits it into orders and opens the plan form with the size filled in."],
            ["Prices you can check", "xStocks reads use four-hour candles of the token's deepest USDC pool on Solana (GeckoTerminal). SOL uses OKX four-hour candles."],
            ["Honest about its limits", "This release is rule-based, with no language model writing the text. A written summary from an AI assistant is planned and will sit on top of the same numbers."],
          ].map(([t, b]) => (
            <div key={t} className="card p-6">
              <h2 className="subhead">{t}</h2>
              <p className="mt-3 text-[14.5px] text-mute">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shell py-12">
        <div className="card-soft p-6 sm:p-10">
          <Headline fade={`${LANES.length} markets,`} ink="one method." />
          <p className="lead mt-5 max-w-[60ch]">
            The review covers every market: {LANES.map((l) => l.symbol).join(", ")}. xStocks are identified by mint, never by ticker, and priced by the Pyth feed that carries the same name.
          </p>
          <p className="mt-6 text-[13px] text-mute">A review is analysis of public price data, not investment advice. Markets can move through any level without stopping.</p>
        </div>
      </section>
    </main>
  );
}
