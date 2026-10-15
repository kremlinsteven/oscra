import { BRAND } from "@/config/brand";
import { RUNBOOK_TERMS } from "@/config/lanes";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/pricing",
  title: `Pricing | ${BRAND.name}`,
  description: `${BRAND.name} has no subscription: a fixed fee per order once ${BRAND.symbol} launches, a lower rate for holders and stakers, and every fee shared with stakers.`,
});

const fee = RUNBOOK_TERMS.feeBps / 100;
const holder = RUNBOOK_TERMS.holderFeeBps / 100;
const min = Number(RUNBOOK_TERMS.holderMin / 10n ** 18n).toLocaleString("en-US");

export default function PricingPage() {
  return (
    <main>
      <PageHead
        tag="Pricing"
        fade="Pay per order,"
        ink="not per month."
        lead={`There are no plans to pick and no trial to expire. The workspace is free to use. The Runbook contract takes a fixed share of each order it fills, and that rate is written into the contract at deployment, so nobody can raise it later.`}
      />
      <section className="shell grid grid-cols-1 gap-4 py-8 md:grid-cols-3">
        {[
          ["Before launch", "0%", `Until ${BRAND.symbol} exists and the staking contract is linked, the Runbook charges nothing.`, "Every plan and copy, from the first deployment"],
          ["Standard", `${fee}%`, "Of each order's size, taken in USDG when the order fills.", "After the one-time link to the staking contract"],
          ["Holders and stakers", `${holder}%`, `For wallets that hold or stake at least ${min} ${BRAND.symbol} at the moment of the order.`, "Checked on-chain per order"],
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
        <Headline fade="Where the fee goes," ink="to the last cent." />
        <div className="space-y-4 text-[15px] text-ink-2">
          <p>Each fee is sent to OscraKeel, the staking contract, in the same transaction as the order. It is split across everyone staking {BRAND.symbol} at that moment, in proportion to their stake, and they claim it in USDG whenever they like.</p>
          <p>There is no treasury wallet and no team cut inside the contracts. If nobody is staking when a fee arrives, it waits for the first staker.</p>
          <p>Other costs are outside {BRAND.name}: Robinhood Chain gas for each transaction, the Uniswap pool fee of the market (0.01% to 0.3%), and price impact on larger orders. A keeper tip applies only if you set one and someone else runs your buy.</p>
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
