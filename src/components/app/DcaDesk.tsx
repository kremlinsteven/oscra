"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { encodeFunctionData, maxUint256 } from "viem";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, LaneSelect, NumberInput, Section, StateChip, fmt, n, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { LANES, LIMITS } from "@/config/lanes";
import { ERC20_ABI, RUNBOOK_ABI } from "@/lib/abi";
import { PLAN_STATES, readPlans, readWallet, type ChainPlan } from "@/lib/live";
import { averageEntry, openPlan, runPlan, setPlanState } from "@/lib/practice";
import { span } from "@/lib/format";

type Draft = { lane: number; perBuy: string; hours: string; budget: string; ceiling: string; slip: string; guard: string; target: string; tip: string; delayH: string };

const micro = (x: number) => BigInt(Math.round(x * 1e6));
const feedUnits = (x: number) => BigInt(Math.round(x * 1e8));

export function DcaDesk() {
  const { live, book, act, now, price, send, busy, tick } = useWorkspace();
  const { address } = useWallet();
  const params = useSearchParams();
  const [d, setD] = useState<Draft>(() => {
    // A review can hand over a market and an order size in the URL.
    const lane = Number(params.get("lane"));
    const size = params.get("perBuy");
    return { lane: LANES.some((l) => l.id === lane) ? lane : 0, perBuy: size && Number(size) > 0 ? size : "50", hours: "24", budget: "500", ceiling: "", slip: "1.5", guard: "15", target: "", tip: "0", delayH: "0" };
  });
  const [plans, setPlans] = useState<ChainPlan[]>([]);
  const [allowance, setAllowance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!live || !address) return;
    let off = false;
    readPlans(address).then((p) => !off && setPlans(p)).catch(() => {});
    readWallet(address).then((w) => !off && setAllowance(w.allowance)).catch(() => {});
    return () => {
      off = true;
    };
  }, [live, address, tick]);

  const set = (k: keyof Draft) => (v: string | number) => setD((x) => ({ ...x, [k]: v }));
  const perBuy = n(d.perBuy);
  const budget = n(d.budget);
  const orders = perBuy > 0 && budget >= perBuy ? Math.ceil(budget / perBuy) : 0;
  const hours = n(d.hours);
  const terms = {
    lane: d.lane,
    perBuy,
    interval: Math.round(hours * 3600),
    budget,
    ceiling: d.ceiling.trim() ? n(d.ceiling) : 0,
    slipBps: Math.round(n(d.slip) * 100),
    guardBps: d.guard.trim() ? Math.round(n(d.guard) * 100) : 0,
    targetBps: d.target.trim() ? Math.round(n(d.target) * 100) : 0,
    tip: d.tip.trim() ? n(d.tip) : 0,
  };
  const valid = [terms.perBuy, terms.budget, terms.interval, terms.slipBps, terms.guardBps, terms.targetBps, terms.tip, terms.ceiling].every(Number.isFinite);
  const px = price(d.lane);
  const needApproval = live && allowance !== null && Number.isFinite(budget) && allowance < micro(budget);

  function submit() {
    if (!valid) return;
    const startAt = now() + Math.max(0, Math.round(n(d.delayH) * 3600) || 0);
    if (!live) {
      act("Open plan", (b, t) => {
        const p = openPlan(b, { ...terms, startAt: d.delayH && n(d.delayH) > 0 ? startAt : 0 }, t);
        return `Plan #${p.id} opened (practice).`;
      });
      return;
    }
    const args = {
      lane: d.lane,
      perBuy: micro(terms.perBuy),
      interval: terms.interval,
      budget: micro(terms.budget),
      ceiling: terms.ceiling ? feedUnits(terms.ceiling) : 0n,
      slipBps: terms.slipBps,
      guardBps: terms.guardBps,
      targetBps: terms.targetBps,
      tip: micro(terms.tip),
      startAt: BigInt(n(d.delayH) > 0 ? startAt : 0),
    };
    send("Open plan", CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "openPlan", args: [args] }));
  }

  const view = live
    ? plans.map((p) => ({ id: p.id, lane: p.lane, state: PLAN_STATES[p.state] ?? "closed", perBuy: Number(p.perBuy) / 1e6, budget: Number(p.budget) / 1e6, spent: Number(p.spent) / 1e6, bought: Number(p.bought) / 1e18, avg: Number(p.avg) / 1e8, nextAt: p.nextAt, buys: p.buys, interval: p.interval, ceiling: Number(p.ceiling) / 1e8, guardBps: p.guardBps, targetBps: p.targetBps }))
    : book.plans.map((p) => ({ ...p, avg: averageEntry(p) })).slice().reverse();

  function run(id: number, lane: number) {
    if (!live) {
      act("Run due buy", (b, t) => {
        const o = runPlan(b, id, price(lane) ?? 0, t);
        return o === "filled" ? `Plan #${id} bought (practice).` : o === "guarded" ? `Plan #${id} paused by its drawdown guard.` : `Plan #${id} paused at its target.`;
      });
      return;
    }
    send(`Run plan #${id}`, CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "runPlan", args: [BigInt(id)] }));
  }
  function change(id: number, to: "held" | "active" | "closed") {
    if (!live) {
      act(to === "held" ? "Hold plan" : to === "active" ? "Resume plan" : "Close plan", (b, t) => setPlanState(b, id, to, t));
      return;
    }
    const fn = to === "held" ? "holdPlan" : to === "active" ? "resumePlan" : "closePlan";
    send(`${fn} #${id}`, CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: fn, args: [BigInt(id)] }));
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Section title="Write a plan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Market">
            <LaneSelect value={d.lane} onChange={set("lane")} testId="plan-lane" />
          </Field>
          <Field label="Order size (USDG)" hint={`At least ${LIMITS.minSpend} USDG.`}>
            <NumberInput value={d.perBuy} onChange={set("perBuy")} testId="plan-size" />
          </Field>
          <Field label="Every (hours)" hint={`${LIMITS.minIntervalH} hour to ${LIMITS.maxIntervalD} days.`}>
            <NumberInput value={d.hours} onChange={set("hours")} testId="plan-hours" />
          </Field>
          <Field label="Budget (USDG)" hint="The plan stops when this is spent.">
            <NumberInput value={d.budget} onChange={set("budget")} testId="plan-budget" />
          </Field>
          <Field label="Price ceiling ($, optional)" hint={px ? `Feed now: $${fmt(px)}. Buys wait while price is above.` : "Buys wait while price is above."}>
            <NumberInput value={d.ceiling} onChange={set("ceiling")} />
          </Field>
          <Field label="Slippage limit (%)" hint="0.5% to 5%. Must cover the pool fee.">
            <NumberInput value={d.slip} onChange={set("slip")} />
          </Field>
          <Field label="Drawdown guard (%, optional)" hint="Pause when price is this far under your average.">
            <NumberInput value={d.guard} onChange={set("guard")} />
          </Field>
          <Field label="Target pause (%, optional)" hint="Pause when price is this far over your average.">
            <NumberInput value={d.target} onChange={set("target")} />
          </Field>
          <Field label="Keeper tip per buy (USDG)" hint="Paid only when someone else runs the buy. Up to a tenth of the order.">
            <NumberInput value={d.tip} onChange={set("tip")} />
          </Field>
          <Field label="First buy in (hours)" hint="0 = due now.">
            <NumberInput value={d.delayH} onChange={set("delayH")} />
          </Field>
        </div>
        <div className="mt-5 rounded-[14px] bg-card-2 p-4 text-[13.5px] text-ink-2">
          {orders ? (
            <>
              {orders} orders of {fmt(perBuy)} USDG, one every {Number.isFinite(hours) ? span(hours * 3600) : "–"}: the budget lasts about {Number.isFinite(hours) ? span(orders * hours * 3600) : "–"}.
              {px ? ` At today's feed price one order buys about ${qtyFmt(perBuy / px)} ${LANES[d.lane].symbol}.` : ""}
            </>
          ) : (
            "Enter an order size and a budget at least as large."
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {needApproval ? (
            <button
              type="button"
              disabled={busy !== null}
              className="btn btn-lime"
              onClick={() => send("Approve USDG", USDG.address, encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.runbook as `0x${string}`, micro(budget)] }))}
            >
              Approve {fmt(budget)} USDG
            </button>
          ) : null}
          <button type="button" disabled={!valid || busy !== null || needApproval || (live && !address)} className="btn btn-ink" onClick={submit} data-testid="plan-open">
            {live ? "Open plan (wallet)" : "Open practice plan"}
          </button>
          {live ? (
            <button type="button" disabled={busy !== null || !address} className="btn btn-ghost" onClick={() => send("Approve unlimited USDG", USDG.address, encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.runbook as `0x${string}`, maxUint256] }))}>
              Approve without a limit
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="Your plans">
        {view.length ? (
          <ul className="grid gap-3" data-testid="plan-list">
            {view.map((p) => {
              const due = p.state === "active" && now() >= p.nextAt;
              return (
                <li key={p.id} className="rounded-[16px] border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold">
                      #{p.id} · {LANES[p.lane]?.symbol} · {fmt(p.perBuy)} USDG every {span(p.interval)}
                    </span>
                    <StateChip state={p.state} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                    {[
                      ["Spent", `${fmt(p.spent)} / ${fmt(p.budget)}`],
                      ["Bought", qtyFmt(p.bought)],
                      ["Average", p.avg ? `$${fmt(p.avg)}` : "–"],
                      ["Next buy", p.state !== "active" ? "–" : due ? "due now" : `in ${span(p.nextAt - now())}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="label">{k}</dt>
                        <dd className="num mt-0.5">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[12px] text-mute">
                    {p.ceiling ? `Ceiling $${fmt(p.ceiling)} · ` : ""}
                    {p.guardBps ? `guard −${p.guardBps / 100}% · ` : ""}
                    {p.targetBps ? `target +${p.targetBps / 100}% · ` : ""}
                    {p.buys} buys
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-ink btn-sm" disabled={!due || busy !== null} onClick={() => run(p.id, p.lane)} data-testid={`plan-run-${p.id}`}>
                      Run due buy
                    </button>
                    {p.state === "active" ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => change(p.id, "held")}>
                        Hold
                      </button>
                    ) : null}
                    {["held", "guarded", "targeted"].includes(p.state) ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => change(p.id, "active")}>
                        Resume
                      </button>
                    ) : null}
                    {p.state !== "closed" ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => change(p.id, "closed")}>
                        Close
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{live && !address ? "Connect a wallet to see its plans." : "No plans yet. The form on the left opens one."}</Empty>
        )}
        <p className="hint mt-4">A due buy runs when someone calls it: you here, or any keeper bot that collects the tip you set. No OSCRA keeper is running yet, so plan to press Run yourself.</p>
      </Section>
    </div>
  );
}
