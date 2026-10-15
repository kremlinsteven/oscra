"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Section, StateChip, fmt, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDC } from "@/config/brand";
import { LANES, laneByMint } from "@/config/lanes";
import { listRecurring, type RecurringOrder } from "@/lib/jupiter";
import { averageEntry } from "@/lib/practice";
import { ago } from "@/lib/format";

const toNum = (v: bigint | null, dec: number) => (v === null ? NaN : Number(v) / 10 ** dec);

export function Overview() {
  const { book, price, tick, now, wallet: walletState, board } = useWorkspace();
  const { address } = useWallet();
  const [orders, setOrders] = useState<RecurringOrder[]>([]);
  const wallet = address ? walletState : null;
  const live = Boolean(address);

  useEffect(() => {
    if (!address) return;
    let off = false;
    listRecurring(address, "active")
      .then((o) => !off && setOrders(o))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [address, tick]);

  // Positions: the connected wallet, else the practice book.
  const rows = LANES.map((l) => {
    const qty = live ? toNum(wallet?.assets[l.id] ?? null, l.decimals) : (book.assets[l.id] ?? 0);
    const px = price(l.id);
    return { lane: l, qty, value: px && Number.isFinite(qty) ? qty * px : 0 };
  }).filter((r) => r.qty > 0);
  const cash = live ? toNum(wallet?.usdc ?? null, USDC.decimals) : book.dollars;
  const exposure = rows.reduce((a, r) => a + r.value, 0);
  const largest = rows.reduce((a, r) => (r.value > a.value ? r : a), { value: 0, lane: LANES[0], qty: 0 });
  const planList = live
    ? orders.map((o, i) => {
        const used = Number(o.inUsed);
        const got = Number(o.outReceived);
        return { id: i + 1, key: o.orderKey, lane: laneByMint(o.outputMint)?.id ?? -1, state: "active", spent: used, budget: Number(o.inDeposited), avg: got > 0 ? used / got : 0 };
      })
    : book.plans.map((p) => ({ id: p.id, key: String(p.id), lane: p.lane, state: p.state, spent: p.spent, budget: p.budget, avg: averageEntry(p) }));
  const followCount = live ? (board?.mine?.follows.length ?? 0) : Object.values(book.follows).filter((f) => f.active).length;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [live ? "USDC in wallet" : "Practice USDC", Number.isFinite(cash) ? `$${fmt(cash)}` : "–"],
            ["Exposure", `$${fmt(exposure)}`],
            ["Largest share", exposure > 0 ? `${largest.lane.symbol} ${fmt((largest.value / exposure) * 100, 0)}%` : "–"],
            ["Plans · follows", `${planList.filter((p) => p.state === "active").length} · ${followCount}`],
          ].map(([k, v]) => (
            <div key={k} className="card p-4">
              <p className="label">{k}</p>
              <p className="num mt-2 truncate text-[20px]">{v}</p>
            </div>
          ))}
        </div>
        <Section title={live ? "Wallet positions" : "Practice positions"} aside={<span className="text-[12px] text-mute">valued at live Pyth / Jupiter prices</span>}>
          {rows.length ? (
            <div className="scroll-x">
              <table className="w-full min-w-[480px] text-[14px]">
                <thead className="text-left text-mute">
                  <tr>
                    <th className="pb-2 font-medium">Market</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.lane.id} className="border-t border-line">
                      <td className="py-2.5 font-semibold">{r.lane.symbol}</td>
                      <td className="num py-2.5 text-right">{qtyFmt(r.qty)}</td>
                      <td className="num py-2.5 text-right">${fmt(price(r.lane.id) ?? NaN)}</td>
                      <td className="num py-2.5 text-right">${fmt(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{live ? "This wallet holds none of the ten markets yet." : "No practice positions yet. Connect a wallet to see real ones."}</Empty>
          )}
        </Section>
        <Section title={live ? "Jupiter recurring orders" : "Practice plans"} aside={<Link href="/app/dca" className="btn btn-ghost btn-sm">Manage</Link>}>
          {planList.length ? (
            <ul className="divide-y divide-line">
              {planList.slice(0, 8).map((p) => (
                <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                  <span className="font-semibold">
                    #{p.id} · {LANES[p.lane]?.symbol ?? "other"}
                  </span>
                  <span className="num text-mute">
                    ${fmt(p.spent)} / ${fmt(p.budget)} · avg {p.avg ? `$${fmt(p.avg)}` : "–"}
                  </span>
                  <StateChip state={p.state} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{live ? "No active recurring orders. Create one under Recurring buys." : "No plans yet. Write one under Recurring buys."}</Empty>
          )}
        </Section>
      </div>
      <div className="grid min-w-0 content-start gap-5">
        <Section title="Who holds what">
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <li>Recurring buys: your USDC sits in a Jupiter order account that only your wallet can cancel; cancelling returns everything.</li>
            <li>Copied trades: each one is a Jupiter swap your wallet signs. Nothing is pre-approved and nothing runs without you.</li>
            <li>Follows, desk ideas and votes: free wallet signatures stored by OSCRA. They move no funds.</li>
            <li>Practice: 10,000 practice USDC in this browser, live prices, +1 h / +1 day to move the clock.</li>
          </ul>
        </Section>
        <Section title="Practice activity">
          {book.activity.length ? (
            <ul className="space-y-2.5">
              {book.activity.slice(0, 12).map((a, i) => (
                <li key={i} className="text-[13px]">
                  <span className="num mr-2 text-mute">{ago(a.at, now())}</span>
                  {a.text}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{live ? "Practice activity shows here. Real actions are linked to the explorer in the notices." : "Nothing yet."}</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
