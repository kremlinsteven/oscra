"use client";

import { useState } from "react";
import Link from "next/link";
import { ReviewPanel, useReview } from "@/components/home/ReviewPanel";
import { useWorkspace } from "@/components/app/Workspace";
import { Field, LaneSelect, NumberInput, Section, fmt, n } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { LANES } from "@/config/lanes";
import { sizeFromStop } from "@/lib/review";

export function ReviewDesk() {
  const [lane, setLane] = useState(0);
  const { data } = useReview(lane);
  const { book, wallet } = useWorkspace();
  const { address } = useWallet();
  const [typed, setAccount] = useState<string | null>(null);
  const walletUsdc = address && wallet?.usdc != null ? String(Math.round(Number(wallet.usdc) / 1e6)) : null;
  const [risk, setRisk] = useState("1");
  const [orders, setOrders] = useState("10");

  // What the person typed wins; otherwise the wallet's USDC, else the practice balance.
  const account = typed ?? walletUsdc ?? String(Math.round(book.dollars));

  const sizing = data ? sizeFromStop(n(account), n(risk), data.stopDistance) : null;
  const per = sizing && n(orders) > 0 ? sizing.size / n(orders) : null;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="grid min-w-0 content-start gap-4">
        <div className="max-w-[340px]">
          <Field label="Market">
            <LaneSelect value={lane} onChange={setLane} testId="review-lane" />
          </Field>
        </div>
        <ReviewPanel lane={lane} />
      </div>
      <Section title="Size it from the stop">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Account (USDC)" hint={walletUsdc ? "Read from your wallet; edit freely." : "Your practice balance; edit freely."}>
            <NumberInput value={account} onChange={setAccount} />
          </Field>
          <Field label="Risk per idea (%)">
            <NumberInput value={risk} onChange={setRisk} />
          </Field>
          <Field label="Split into orders">
            <NumberInput value={orders} onChange={setOrders} />
          </Field>
        </div>
        {data && sizing ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Stop distance", `${(data.stopDistance * 100).toFixed(2)}%`],
              ["Dollars at risk", `$${fmt(sizing.risk)}`],
              ["Position size", `$${fmt(sizing.size)}`],
              ["Per order", per ? `$${fmt(per)}` : "–"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[14px] bg-card-2 p-3">
                <p className="label">{k}</p>
                <p className="num mt-1 text-[18px]">{v}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-[13.5px] text-mute">{data ? "No recent low under the price: write the stop from your own rule." : "Waiting for the read."}</p>
        )}
        <p className="hint mt-4">
          Size = account × risk ÷ stop distance, capped at the account. The review explains the market; the size comes from your own rule. A stop here is a level to watch: plans buy, they do not sell for
          you.
        </p>
        {per && per >= 1 ? (
          <Link href={`/app/dca?lane=${lane}&perBuy=${Math.floor(per)}`} className="btn btn-ink mt-5">
            Turn into a plan: {Math.floor(per)} USDC of {LANES[lane].symbol} per order
          </Link>
        ) : null}
      </Section>
    </div>
  );
}
