import { BRAND, CHAIN, MEMO_PROGRAM, USDC, explorerAddress, explorerToken } from "@/config/brand";
import { LANES, LIMITS, PRACTICE_TERMS, RECURRING } from "@/config/lanes";
import { Headline, PageHead } from "@/components/site/Blocks";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/contracts",
  title: `On-chain pieces | ${BRAND.name}`,
  description: `How ${BRAND.name} runs on Solana without a program of its own: Jupiter Recurring orders and Jupiter swaps from your wallet, Pyth prices, wallet-signed records, and the markets by mint.`,
});

const PIECES: [string, string, string][] = [
  ["Recurring buys", "Jupiter Recurring (time-based)", `Your wallet signs one order that deposits the USDC; Jupiter fills it on schedule inside your price range and you can cancel it any time to get the rest back. At least ${RECURRING.minPerOrder} USDC per order, ${RECURRING.minOrders}+ orders, Jupiter keeps ${RECURRING.jupiterFeeBps / 100}% per fill.`],
  ["Copied trades", "Jupiter swap from your wallet", `Each copy is one swap you sign, built only after your limits pass: review delay, ${LIMITS.mirrorWindowH}-hour window, chase limit, daily cap, position cap, stop.`],
  ["Follows, desk ideas, polls, votes", "Wallet-signed records", "Free signMessage over a one-time server nonce, checked with ed25519 against your address. They move no funds."],
  ["Recorded copies", "Checked against the chain", "The server reads your swap with getTransaction: fee payer is your wallet, it succeeded, and USDC and the asset moved the way the idea said."],
  ["Prices", "Pyth, then Jupiter", "The Pyth push feed when it is fresh (SOL), else the Jupiter price API matched by mint. Reviews read OKX and Solana pool candles."],
  [`${BRAND.symbol} staking and fee share`, "Practice only", `No staking program exists, so stake, fee share (${PRACTICE_TERMS.feeBps / 100}% / ${PRACTICE_TERMS.holderFeeBps / 100}% practice fee) and the holder discount run in your practice book. Nothing moves.`],
];

function Addr({ v, token }: { v: string; token?: boolean }) {
  return (
    <a href={token ? explorerToken(v) : explorerAddress(v)} target="_blank" rel="noreferrer" className="font-mono break-all underline">
      {v}
    </a>
  );
}

export default function ContractsPage() {
  return (
    <main>
      <PageHead
        tag="Developers"
        fade="No program of our own."
        ink="Existing Solana rails, your signature on each."
        lead={`${BRAND.name} has no smart contract on ${CHAIN.name} and never takes custody. Real orders are Jupiter orders and swaps your wallet signs; everything else is a signed record or practice.`}
      />
      <section className="shell py-8">
        <dl className="divide-y divide-line rounded-[20px] border border-line bg-card">
          {PIECES.map(([what, how, detail]) => (
            <div key={what} className="grid grid-cols-1 gap-1 px-5 py-4 md:grid-cols-[minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,1.2fr)] md:gap-6">
              <dt className="text-[14px] font-semibold">{what}</dt>
              <dd className="font-mono text-[13px] text-ink-2">{how}</dd>
              <dd className="text-[14px] text-mute">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="shell py-12">
        <Headline fade="Markets" ink="identified by mint." />
        <div className="scroll-x mt-8 rounded-[20px] border border-line bg-card">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="text-mute">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Market</th>
                <th className="px-4 py-3 font-medium">Mint</th>
                <th className="px-4 py-3 font-medium">Pyth feed id</th>
                <th className="px-4 py-3 font-medium">Program</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="num px-4 py-2.5">{l.id}</td>
                  <td className="px-4 py-2.5 font-semibold">{l.symbol}</td>
                  <td className="px-4 py-2.5">
                    <Addr v={l.mint} token />
                  </td>
                  <td className="px-4 py-2.5 font-mono break-all text-mute">{l.feedId.slice(0, 10)}…{l.feedId.slice(-6)}</td>
                  <td className="px-4 py-2.5">{l.token2022 ? "Token-2022" : "SPL Token"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13.5px] text-ink-2">
          Every plan is priced in USDC <Addr v={USDC.mint} token />. xStocks mints are Token-2022 with issuer controls (permanent delegate, pause, scaled UI amount for dividends): that is the issuer&apos;s power, not
          {" "}{BRAND.name}&apos;s. Anchoring a record&apos;s hash on-chain with the SPL Memo program <Addr v={MEMO_PROGRAM} /> is planned, not built yet: records live on the server, each one signed by its wallet.
        </p>
      </section>
    </main>
  );
}
