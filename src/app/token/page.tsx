import { BRAND, PONS_TOKEN_URL, TOKEN } from "@/config/brand";
import { KEEL_TERMS, RUNBOOK_TERMS } from "@/config/lanes";
import { ContractTag } from "@/components/site/ContractTag";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { TokenFacts } from "@/components/site/TokenFacts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `${BRAND.symbol} is the ${BRAND.name} token on Robinhood Chain: stake it for a USDG share of every Runbook fee, a lower fee rate and a vote in polls.`,
});

const tokens = (v: bigint) => Number(v / 10n ** 18n).toLocaleString("en-US");

export default function TokenPage() {
  return (
    <main>
      <PageHead
        tag={`${BRAND.symbol} · ${BRAND.chainName}`}
        fade={`${BRAND.symbol}:`}
        ink="a share of the fees, a lower rate, a vote."
        lead={`${BRAND.symbol} connects holders to the one thing ${BRAND.name} earns: the fee on each order. Every use below is a function in a published contract, not a promise on a slide.`}
        aside={
          <div className="grid gap-3">
            <ContractTag shape="slab" />
            <TokenFacts />
          </div>
        }
      >
        {TOKEN.isLive ? (
          <a href={PONS_TOKEN_URL(BRAND.ca)} target="_blank" rel="noreferrer" className="btn btn-ink">
            Trade on Pons
          </a>
        ) : (
          <span className="btn btn-ghost cursor-default">Launching on Pons, Robinhood Chain</span>
        )}
        <Cta href="/contracts" kind="ghost">
          Read the contracts
        </Cta>
      </PageHead>

      <section className="shell grid grid-cols-1 gap-4 py-12 md:grid-cols-3">
        {[
          ["Fee share", "Live once OscraKeel is deployed", `Stake ${BRAND.symbol} in OscraKeel. Every USDG fee the Runbook collects is split across stakers by stake size, claimable at any time.`],
          ["Lower fee", "Live once the Runbook is bound", `Hold or stake ${tokens(RUNBOOK_TERMS.holderMin)} ${BRAND.symbol} and your orders pay ${RUNBOOK_TERMS.holderFeeBps / 100}% instead of ${RUNBOOK_TERMS.feeBps / 100}%. Checked per order, on-chain.`],
          ["Polls", "Live once OscraKeel is deployed", `Stakers vote with their stake. ${tokens(KEEL_TERMS.proposerMin)} staked opens a poll on features, markets or the fee for the next contract version. A vote locks the stake until the poll ends.`],
        ].map(([t, s, b]) => (
          <div key={t} className="card flex flex-col p-6">
            <h2 className="subhead">{t}</h2>
            <span className="chip chip-light-watch mt-3 self-start">{s}</span>
            <p className="mt-4 text-[14.5px] text-mute">{b}</p>
          </div>
        ))}
      </section>

      <section className="shell grid grid-cols-1 gap-10 py-16 lg:grid-cols-2">
        <Headline fade="What the token" ink="does not do." />
        <ul className="space-y-3 text-[15px] text-ink-2">
          <li>It does not give anyone control of the contracts. They have no admin, and a poll result cannot change a deployed contract.</li>
          <li>It does not promise a return. Fee share depends entirely on how much people trade through the Runbook.</li>
          <li>Premium features and API access for holders are planned, not live. They will be announced with their terms first.</li>
          <li>Thresholds above assume a supply of one billion tokens and are set once, at deployment.</li>
        </ul>
      </section>

      <section className="shell py-12">
        <div className="card-soft p-6 sm:p-10">
          <h2 className="headline">
            <span className="fade">How to get</span> {BRAND.symbol}
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 text-[14.5px] text-ink-2 md:grid-cols-3">
            <li>1. Add Robinhood Chain to an EVM wallet: connecting on this site does it for you.</li>
            <li>2. Bridge or buy ETH on Robinhood Chain for gas and for the trade.</li>
            <li>3. {TOKEN.isLive ? `Buy ${BRAND.symbol} on its Pons page, using the contract address above.` : `At launch, buy ${BRAND.symbol} on Pons. Use only the address published on this page and on X ${BRAND.xHandle}.`}</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
