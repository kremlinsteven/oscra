"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { encodeFunctionData } from "viem";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Section, StateChip, fmt, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CONTRACTS } from "@/config/contracts";
import { USDG } from "@/config/brand";
import { LANES } from "@/config/lanes";
import { ERC20_ABI } from "@/lib/abi";
import { PLAN_STATES, readFollows, readPlans, readWallet, type ChainFollow, type ChainPlan, type Wallet } from "@/lib/live";
import { averageEntry } from "@/lib/practice";
import { ago } from "@/lib/format";

const toNum = (v: bigint | null, dec: number) => (v === null ? NaN : Number(v) / 10 ** dec);

export function Overview() {
  const { live, book, price, tick, send, busy, now } = useWorkspace();
  const { address } = useWallet();
  const [walletState, setWallet] = useState<Wallet | null>(null);
  const [plans, setPlans] = useState<ChainPlan[]>([]);
  const [follows, setFollows] = useState<ChainFollow[]>([]);
  const wallet = address ? walletState : null;

  useEffect(() => {
    if (!address) return;
    let off = false;
    readWallet(address).then((w) => !off && setWallet(w)).catch(() => {});
    if (live) {
      readPlans(address).then((p) => !off && setPlans(p)).catch(() => {});
      readFollows(address).then((f) => !off && setFollows(f.follows)).catch(() => {});
    }
    return () => {
      off = true;
    };
  }, [address, live, tick]);

  // Positions: practice book in practice mode, the real wallet in live mode.
  const rows = LANES.map((l) => {
    const qty = live ? toNum(wallet?.assets[l.id] ?? null, l.decimals) : (book.assets[l.id] ?? 0);
    const px = price(l.id);
    return { lane: l, qty, value: px && Number.isFinite(qty) ? qty * px : 0 };
  }).filter((r) => r.qty > 0);
  const cash = live ? toNum(wallet?.usdg ?? null, USDG.decimals) : book.dollars;
  const exposure = rows.reduce((a, r) => a + r.value, 0);
  const largest = rows.reduce((a, r) => (r.value > a.value ? r : a), { value: 0, lane: LANES[0], qty: 0 });
  const planList = live
    ? plans.map((p) => ({ id: p.id, lane: p.lane, state: PLAN_STATES[p.state] ?? "closed", spent: Number(p.spent) / 1e6, budget: Number(p.budget) / 1e6, avg: Number(p.avg) / 1e8 }))
    : book.plans.map((p) => ({ id: p.id, lane: p.lane, state: p.state, spent: p.spent, budget: p.budget, avg: averageEntry(p) }));
  const followCount = live ? follows.filter((f) => f.active).length : Object.values(book.follows).filter((f) => f.active).length;
  const allowance = wallet?.allowance ?? null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [live ? "USDG in wallet" : "Practice USDG", Number.isFinite(cash) ? `$${fmt(cash)}` : "–"],
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
        <Section title={live ? "Wallet positions" : "Practice positions"} aside={<span className="text-[12px] text-mute">valued at Chainlink prices</span>}>
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
            <Empty>{live && !address ? "Connect a wallet to read its positions." : "No positions in the ten lanes yet."}</Empty>
          )}
        </Section>
        <Section title="Plans" aside={<Link href="/app/dca" className="btn btn-ghost btn-sm">Manage</Link>}>
          {planList.length ? (
            <ul className="divide-y divide-line">
              {planList.slice(0, 8).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[14px]">
                  <span className="font-semibold">
                    #{p.id} · {LANES[p.lane]?.symbol}
                  </span>
                  <span className="num text-mute">
                    ${fmt(p.spent)} / ${fmt(p.budget)} · avg {p.avg ? `$${fmt(p.avg)}` : "–"}
                  </span>
                  <StateChip state={p.state} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No plans yet. Write one under Recurring buys.</Empty>
          )}
        </Section>
      </div>
      <div className="grid min-w-0 content-start gap-5">
        {live ? (
          <Section title="Spending permission">
            <p className="text-[14px] text-ink-2">
              USDG the Runbook may pull from this wallet:{" "}
              <strong className="num">{allowance === null ? "–" : allowance > 10n ** 30n ? "unlimited" : `$${fmt(Number(allowance) / 1e6)}`}</strong>
            </p>
            <p className="hint">The allowance is the only thing the Runbook can use. Set it to zero and every plan and follow stops.</p>
            <button
              type="button"
              disabled={!address || !allowance || busy !== null}
              className="btn btn-ink mt-4"
              onClick={() => send("Revoke USDG allowance", USDG.address, encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.runbook as `0x${string}`, 0n] }))}
            >
              Set allowance to zero
            </button>
          </Section>
        ) : (
          <Section title="How practice works">
            <ul className="space-y-2 text-[13.5px] text-ink-2">
              <li>You start with 10,000 practice USDG kept in this browser.</li>
              <li>Buys fill at the live Chainlink price minus the pool fee tier of the lane.</li>
              <li>Use +1 h and +1 day to move the practice clock and reach the next buy.</li>
              <li>The rules are the contract&apos;s rules, refusal messages included.</li>
            </ul>
          </Section>
        )}
        <Section title="Activity">
          {live ? (
            <p className="text-[13.5px] text-mute">Every action is a transaction: the notices link each one to the explorer.</p>
          ) : book.activity.length ? (
            <ul className="space-y-2.5">
              {book.activity.slice(0, 12).map((a, i) => (
                <li key={i} className="text-[13px]">
                  <span className="num mr-2 text-mute">{ago(a.at, now())}</span>
                  {a.text}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing yet.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
