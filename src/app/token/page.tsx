import { BRAND, DEXSCREENER_TOKEN_URL, PUMP_TOKEN_URL, TOKEN } from "@/config/brand";
import { PRACTICE_TERMS } from "@/config/lanes";
import { ContractTag } from "@/components/site/ContractTag";
import { Cta, Headline, PageHead } from "@/components/site/Blocks";
import { TokenFacts } from "@/components/site/TokenFacts";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `${BRAND.symbol} is the ${BRAND.name} token on Solana, launched on pump.fun: a vote in polls weighted by what you hold, and a fee share and discount you can try in practice.`,
});

const tokens = (v: number) => v.toLocaleString("en-US");

export default function TokenPage() {
  return (
    <main>
      <PageHead
        tag={`${BRAND.symbol} · ${BRAND.chainName}`}
        fade={`${BRAND.symbol}:`}
        ink="a vote today, a fee share in practice."
        lead={`${BRAND.symbol} is a pump.fun token on Solana (1,000,000,000 supply, 6 decimals). Below is exactly what it does today and what runs only as practice, with no promise attached.`}
        aside={
          <div className="grid gap-3">
            <ContractTag shape="slab" />
            <TokenFacts />
          </div>
        }
      >
        {TOKEN.isLive ? (
          <>
            <a href={PUMP_TOKEN_URL(BRAND.ca)} target="_blank" rel="noreferrer" className="btn btn-ink">
              Trade on pump.fun
            </a>
            <a href={DEXSCREENER_TOKEN_URL(BRAND.ca)} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Chart
            </a>
          </>
        ) : (
          <span className="btn btn-ghost cursor-default">Launching on pump.fun, Solana</span>
        )}
        <Cta href="/contracts" kind="ghost">
          How it runs on-chain
        </Cta>
      </PageHead>

      <section className="shell grid grid-cols-1 gap-4 py-12 md:grid-cols-3">
        {[
          ["Polls", "Live at launch", `Vote with a free wallet signature; the vote weighs the ${BRAND.symbol} your wallet holds at that moment. ${tokens(PRACTICE_TERMS.proposerMin)} ${BRAND.symbol} in a wallet opens a poll. Results are advisory.`],
          ["Fee share", "Practice", `Stake practice ${BRAND.symbol} in the workspace and claim a share of practice fees. No staking program exists and no real fee is collected, so nothing here pays out.`],
          ["Lower fee", "Practice", `Hold or stake ${tokens(PRACTICE_TERMS.holderMin)} practice ${BRAND.symbol} and practice orders pay ${PRACTICE_TERMS.holderFeeBps / 100}% instead of ${PRACTICE_TERMS.feeBps / 100}%. Real Jupiter orders pay no ${BRAND.name} fee at all.`],
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
          <li>It does not give anyone control of your funds. {BRAND.name} has no contract to control, and a poll only shapes what gets built next.</li>
          <li>It does not promise a return. The fee share is practice only; there is no real revenue paid to holders.</li>
          <li>Premium features and API access for holders are planned, not live. They will be announced with their terms first.</li>
          <li>Thresholds above assume the pump.fun supply of one billion tokens.</li>
        </ul>
      </section>

      <section className="shell py-12">
        <div className="card-soft p-6 sm:p-10">
          <h2 className="headline">
            <span className="fade">How to get</span> {BRAND.symbol}
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-4 text-[14.5px] text-ink-2 md:grid-cols-3">
            <li>1. Install a Solana wallet such as Phantom, Solflare or Backpack.</li>
            <li>2. Fund it with SOL for the trade and the network fee.</li>
            <li>3. {TOKEN.isLive ? `Buy ${BRAND.symbol} on its pump.fun page, using the mint address above.` : `At launch, buy ${BRAND.symbol} on pump.fun. Use only the mint address published on this page and on X ${BRAND.xHandle}.`}</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
