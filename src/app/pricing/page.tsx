import { BRAND } from "@/config/brand";
import { PRACTICE_TERMS, RECURRING } from "@/config/lanes";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/pricing",
  title: `Pricing | ${BRAND.name}`,
  description: `${BRAND.name} has no subscription and adds no fee to real orders: you pay only Jupiter and the Solana network. The ${BRAND.symbol} fee share and holder rate run in practice only.`,
});

const fee = PRACTICE_TERMS.feeBps / 100;
const holder = PRACTICE_TERMS.holderFeeBps / 100;
const min = PRACTICE_TERMS.holderMin.toLocaleString("en-US");

export default function PricingPage() {
  return (
    <main>
      <PageHead
        tag="Pricing"
        fade="No OSCRA fee"
        ink="on real orders."
        lead={`There are no plans to pick and no trial to expire. The workspace is free to use, and real orders pay only Jupiter and the Solana network. The ${BRAND.symbol} fee model is something you can try in practice.`}
      />
      <section className="shell grid grid-cols-1 gap-4 py-8 md:grid-cols-3">
        {[
          ["Real orders", "0%", `${BRAND.name} adds nothing to Jupiter Recurring orders or copied swaps. Jupiter keeps ${RECURRING.jupiterFeeBps / 100}% of each filled recurring order.`, "Every real plan and copy"],
          ["Practice standard", `${fee}%`, "Of each practice order, paid in practice USDC into the practice stake pool.", "Practice book only: no funds move"],
          ["Practice holders", `${holder}%`, `For practice books that hold or stake at least ${min} practice ${BRAND.symbol}.`, "Practice book only: no funds move"],
        ].map(([k, v, b, s], i) => (
          <div key={k} className={`flex flex-col rounded-[24px] p-6 ${i === 1 ? "bg-night text-night-ink" : "card"}`}>
            <p className={`label ${i === 1 ? "text-night-mute" : ""}`}>{k}</p>
            <p className="mt-6 text-[56px] leading-none font-medium tracking-[-0.04em]">{v}</p>
            <p className={`mt-2 text-[13px] ${i === 1 ? "text-night-mute" : "text-mute"}`}>per order</p>
            <p className={`mt-6 text-[14.5px] ${i === 1 ? "text-night-ink/85" : "text-ink-2"}`}>{b}</p>
            <p className={`mt-auto pt-6 text-[12.5px] ${i === 1 ? "text-lime" : "text-olive"}`}>{s}</p>
          </div>
        ))}
      </section>
      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-2">
        <Headline fade="What you actually pay," ink="to the last cent." />
        <div className="space-y-4 text-[15px] text-ink-2">
          <p>Recurring buys: Jupiter keeps {RECURRING.jupiterFeeBps / 100}% of each filled order. Copied trades: the Jupiter route you see in your wallet, plus price impact on larger orders. Every transaction pays a small Solana network fee and an optional priority fee.</p>
          <p>{BRAND.name} has no program, no treasury cut and no server wallet, so there is nowhere for a fee to go. Signing a follow, an idea or a vote is free.</p>
          <p>The practice fee share shows how a {BRAND.symbol} fee model would behave: practice fees fill a pool that practice stakers claim. It is labelled practice everywhere and never asks for funds.</p>
        </div>
      </section>
      <section className="shell py-12">
        <div className="card-soft flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[60ch] text-[15px] text-ink-2">
            Coming later, and not live today: premium review features and API access for {BRAND.symbol} holders. They will be announced with their terms before they exist.
          </p>
          <Cta href="/token">About {BRAND.symbol}</Cta>
        </div>
      </section>
    </main>
  );
}
