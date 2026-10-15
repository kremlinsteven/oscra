"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VersionedTransaction } from "@solana/web3.js";
import { useMode, useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, LaneSelect, ModeTabs, NumberInput, Section, StateChip, fmt, n, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDC, explorerTx } from "@/config/brand";
import { LANES, LIMITS, RECURRING, laneByMint } from "@/config/lanes";
import { explain, waitForSignature } from "@/lib/client";
import { span } from "@/lib/format";
import { b64ToBytes, bytesToB64, cancelRecurring, createRecurring, executeRecurring, fillCount, listRecurring, type RecurringOrder } from "@/lib/jupiter";
import { averageEntry, openPlan, runPlan, setPlanState } from "@/lib/practice";

export function DcaDesk() {
  const [mode, setMode] = useMode("dca");
  return (
    <>
      <ModeTabs
        mode={mode}
        setMode={setMode}
        realLabel="Real: Jupiter Recurring"
        note={mode === "real" ? "Your wallet signs. Funds sit in a Jupiter order account you alone can cancel; OSCRA never holds them." : "Simulated book in this browser, live prices, nothing sent."}
      />
      {mode === "real" ? <RealPlans /> : <PracticePlans />}
    </>
  );
}

/* ------------------------------------------------------------------ real */

type RealDraft = { lane: number; perOrder: string; orders: string; hours: string; minPrice: string; maxPrice: string; delayH: string };

function RealPlans() {
  const { busy, notify, tick, refresh, wallet, price } = useWorkspace();
  const { address, signTransaction } = useWallet();
  const params = useSearchParams();
  const [d, setD] = useState<RealDraft>(() => {
    const lane = Number(params.get("lane"));
    const size = Number(params.get("perBuy"));
    return { lane: LANES.some((l) => l.id === lane) ? lane : 0, perOrder: size >= RECURRING.minPerOrder ? String(size) : "50", orders: "6", hours: "24", minPrice: "", maxPrice: "", delayH: "0" };
  });
  const [active, setActive] = useState<RecurringOrder[] | null>(null);
  const [history, setHistory] = useState<RecurringOrder[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let off = false;
    listRecurring(address, "active")
      .then((o) => !off && setActive(o))
      .catch(() => !off && setActive([]));
    listRecurring(address, "history", 1)
      .then((o) => !off && setHistory(o.slice(0, 10)))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [address, tick]);

  const set = (k: keyof RealDraft) => (v: string | number) => setD((x) => ({ ...x, [k]: v }));
  const per = n(d.perOrder);
  const count = Math.floor(n(d.orders));
  const hours = n(d.hours);
  const total = per * count;
  const minP = d.minPrice.trim() ? n(d.minPrice) : null;
  const maxP = d.maxPrice.trim() ? n(d.maxPrice) : null;
  const usdcHave = wallet?.usdc != null ? Number(wallet.usdc) / 1e6 : null;
  const problem = !(per >= RECURRING.minPerOrder)
    ? `Jupiter needs at least ${RECURRING.minPerOrder} USDC per order.`
    : !(count >= RECURRING.minOrders && count <= RECURRING.maxOrders)
      ? `Between ${RECURRING.minOrders} and ${RECURRING.maxOrders} orders.`
      : !(hours >= RECURRING.minIntervalH && hours <= RECURRING.maxIntervalD * 24)
        ? `Every ${RECURRING.minIntervalH} hour to ${RECURRING.maxIntervalD} days.`
        : (minP !== null && !(minP > 0)) || (maxP !== null && !(maxP > 0)) || (minP !== null && maxP !== null && minP >= maxP)
          ? "The price range needs a lower bound under the upper bound."
          : usdcHave !== null && usdcHave < total
            ? `This wallet holds ${fmt(usdcHave)} USDC; the plan deposits ${fmt(total)}.`
            : null;
  const px = price(d.lane);

  async function signAndExecute(label: string, get: () => Promise<{ requestId: string; transaction: string }>) {
    if (!address) return notify({ kind: "error", text: "Connect a wallet first." });
    setWorking(label);
    try {
      const { requestId, transaction } = await get();
      const signed = await signTransaction(VersionedTransaction.deserialize(b64ToBytes(transaction)));
      const out = await executeRecurring(requestId, bytesToB64(signed.serialize()));
      if (out.status !== "Success" || !out.signature) throw new Error(out.error || "Jupiter did not land the transaction.");
      notify({ kind: "info", text: `${label}: sent.`, href: explorerTx(out.signature) });
      const r = await waitForSignature(out.signature);
      notify({ kind: r.ok ? "ok" : "error", text: r.ok ? `${label}: confirmed.` : `${label}: ${r.error}`, href: explorerTx(out.signature) });
      refresh();
    } catch (e) {
      notify({ kind: "error", text: `${label}: ${explain(e)}` });
    } finally {
      setWorking(null);
    }
  }

  function create() {
    if (problem || !address) return;
    const delay = Math.max(0, Math.round(n(d.delayH) * 3600) || 0);
    signAndExecute("Create recurring order", () =>
      createRecurring({
        user: address,
        inputMint: USDC.mint,
        outputMint: LANES[d.lane].mint,
        inAmount: BigInt(Math.round(total * 1e6)),
        numberOfOrders: count,
        intervalSec: Math.round(hours * 3600),
        minPrice: minP,
        maxPrice: maxP,
        startAt: delay ? Math.floor(Date.now() / 1000) + delay : null,
      }),
    );
  }

  const disabled = !address || busy !== null || working !== null;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Section title="Write a recurring buy">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Market">
            <LaneSelect value={d.lane} onChange={set("lane")} testId="real-lane" />
          </Field>
          <Field label="Per order (USDC)" hint={`At least ${RECURRING.minPerOrder} USDC (Jupiter rule).`}>
            <NumberInput value={d.perOrder} onChange={set("perOrder")} testId="real-size" />
          </Field>
          <Field label="Number of orders" hint={`At least ${RECURRING.minOrders}.`}>
            <NumberInput value={d.orders} onChange={set("orders")} step="1" testId="real-orders" />
          </Field>
          <Field label="Every (hours)" hint={`${RECURRING.minIntervalH} hour to ${RECURRING.maxIntervalD} days.`}>
            <NumberInput value={d.hours} onChange={set("hours")} testId="real-hours" />
          </Field>
          <Field label="Lowest price ($, optional)" hint="Orders wait while the price is below.">
            <NumberInput value={d.minPrice} onChange={set("minPrice")} />
          </Field>
          <Field label="Price ceiling ($, optional)" hint={px ? `Live now: $${fmt(px)}. Orders wait while above.` : "Orders wait while the price is above."}>
            <NumberInput value={d.maxPrice} onChange={set("maxPrice")} />
          </Field>
          <Field label="First order in (hours)" hint="0 = start now.">
            <NumberInput value={d.delayH} onChange={set("delayH")} />
          </Field>
          <div className="min-w-0 self-end rounded-[14px] bg-card-2 p-3 text-[12.5px] text-mute">
            Wallet USDC: <span className="num text-ink">{usdcHave === null ? (address ? "…" : "–") : fmt(usdcHave)}</span>
          </div>
        </div>
        <div className="mt-5 rounded-[14px] bg-card-2 p-4 text-[13.5px] text-ink-2" data-testid="real-summary">
          {problem ? (
            problem
          ) : (
            <>
              Deposits {fmt(total)} USDC into one Jupiter order: {count} buys of {fmt(per)} USDC of {LANES[d.lane].symbol}, one every {span(hours * 3600)}, done in about {span(count * hours * 3600)}.
              {px ? ` At today's price one order buys about ${qtyFmt(per / px)} ${LANES[d.lane].symbol}.` : ""} Jupiter keeps {RECURRING.jupiterFeeBps / 100}% of each filled order; OSCRA takes nothing.
            </>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-ink" disabled={disabled || problem !== null} onClick={create} data-testid="real-create">
            {working === "Create recurring order" ? "Confirm in wallet…" : address ? "Create order (wallet)" : "Connect a wallet first"}
          </button>
        </div>
        <p className="hint mt-4">Cancel any time: the unspent USDC and everything bought so far return to your wallet. The drawdown guard and target pause are practice-only rules; Jupiter orders run on schedule inside your price range.</p>
      </Section>

      <Section title="Your recurring orders" aside={address ? <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>Refresh</button> : null}>
        {!address ? (
          <Empty>Connect a wallet to read its Jupiter recurring orders.</Empty>
        ) : active === null ? (
          <Empty>Reading orders…</Empty>
        ) : active.length === 0 ? (
          <Empty>No active recurring orders for this wallet.</Empty>
        ) : (
          <ul className="grid gap-3" data-testid="real-list">
            {active.map((o) => (
              <OrderCard key={o.orderKey} o={o} disabled={disabled} onCancel={() => signAndExecute("Cancel order", () => cancelRecurring(address, o.orderKey))} cancelling={working === "Cancel order"} />
            ))}
          </ul>
        )}
        {history.length ? (
          <>
            <h3 className="label mt-6">Finished or cancelled</h3>
            <ul className="mt-2 grid gap-2">
              {history.map((o) => (
                <OrderCard key={o.orderKey} o={o} done />
              ))}
            </ul>
          </>
        ) : null}
      </Section>
    </div>
  );
}

function OrderCard({ o, done, disabled, cancelling, onCancel }: { o: RecurringOrder; done?: boolean; disabled?: boolean; cancelling?: boolean; onCancel?: () => void }) {
  const lane = laneByMint(o.outputMint);
  const sym = lane?.symbol ?? `${o.outputMint.slice(0, 4)}…`;
  const deposited = Number(o.inDeposited);
  const used = Number(o.inUsed);
  const got = Number(o.outReceived);
  const per = Number(o.inAmountPerCycle);
  const avg = got > 0 ? used / got : 0;
  return (
    <li className={`rounded-[16px] border border-line p-4 ${done ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">
          {sym} · {fmt(per)} USDC every {span(Number(o.cycleFrequency))}
        </span>
        <StateChip state={done ? (o.userClosed ? "closed" : "spent") : "active"} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
        {[
          ["Spent", `${fmt(used)} / ${fmt(deposited)}`],
          ["Bought", qtyFmt(got)],
          ["Average", avg ? `$${fmt(avg)}` : "–"],
          ["Fills", String(fillCount(o) ?? "–")],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="num mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={explorerTx(o.openTx)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
          Opening tx
        </a>
        {!done && onCancel ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={onCancel}>
            {cancelling ? "Confirm in wallet…" : "Cancel and withdraw"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ practice */

type Draft = { lane: number; perBuy: string; hours: string; budget: string; ceiling: string; slip: string; guard: string; target: string; delayH: string };

function PracticePlans() {
  const { book, act, now, price, busy } = useWorkspace();
  const params = useSearchParams();
  const [d, setD] = useState<Draft>(() => {
    const lane = Number(params.get("lane"));
    const size = params.get("perBuy");
    return { lane: LANES.some((l) => l.id === lane) ? lane : 0, perBuy: size && Number(size) > 0 ? size : "50", hours: "24", budget: "500", ceiling: "", slip: "1.5", guard: "15", target: "", delayH: "0" };
  });
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
  };
  const valid = [terms.perBuy, terms.budget, terms.interval, terms.slipBps, terms.guardBps, terms.targetBps, terms.ceiling].every(Number.isFinite);
  const px = price(d.lane);

  function submit() {
    if (!valid) return;
    const delay = Math.max(0, Math.round(n(d.delayH) * 3600) || 0);
    act("Open plan", (b, t) => {
      const p = openPlan(b, { ...terms, startAt: delay ? t + delay : 0 }, t);
      return `Plan #${p.id} opened (practice).`;
    });
  }

  const view = book.plans.map((p) => ({ ...p, avg: averageEntry(p) })).slice().reverse();

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Section title="Write a practice plan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Market">
            <LaneSelect value={d.lane} onChange={set("lane")} testId="plan-lane" />
          </Field>
          <Field label="Order size (USDC)" hint={`At least ${LIMITS.minSpend} USDC.`}>
            <NumberInput value={d.perBuy} onChange={set("perBuy")} testId="plan-size" />
          </Field>
          <Field label="Every (hours)" hint={`${LIMITS.minIntervalH} hour to ${LIMITS.maxIntervalD} days.`}>
            <NumberInput value={d.hours} onChange={set("hours")} testId="plan-hours" />
          </Field>
          <Field label="Budget (USDC)" hint="The plan stops when this is spent.">
            <NumberInput value={d.budget} onChange={set("budget")} testId="plan-budget" />
          </Field>
          <Field label="Price ceiling ($, optional)" hint={px ? `Live now: $${fmt(px)}. Buys wait while price is above.` : "Buys wait while price is above."}>
            <NumberInput value={d.ceiling} onChange={set("ceiling")} />
          </Field>
          <Field label="Slippage limit (%)" hint="0.5% to 5%.">
            <NumberInput value={d.slip} onChange={set("slip")} />
          </Field>
          <Field label="Drawdown guard (%, optional)" hint="Pause when price is this far under your average.">
            <NumberInput value={d.guard} onChange={set("guard")} />
          </Field>
          <Field label="Target pause (%, optional)" hint="Pause when price is this far over your average.">
            <NumberInput value={d.target} onChange={set("target")} />
          </Field>
          <Field label="First buy in (hours)" hint="0 = due now.">
            <NumberInput value={d.delayH} onChange={set("delayH")} />
          </Field>
        </div>
        <div className="mt-5 rounded-[14px] bg-card-2 p-4 text-[13.5px] text-ink-2">
          {orders ? (
            <>
              {orders} orders of {fmt(perBuy)} USDC, one every {Number.isFinite(hours) ? span(hours * 3600) : "–"}: the budget lasts about {Number.isFinite(hours) ? span(orders * hours * 3600) : "–"}.
              {px ? ` At today's price one order buys about ${qtyFmt(perBuy / px)} ${LANES[d.lane].symbol}.` : ""}
            </>
          ) : (
            "Enter an order size and a budget at least as large."
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={!valid || busy !== null} className="btn btn-ink" onClick={submit} data-testid="plan-open">
            Open practice plan
          </button>
        </div>
      </Section>

      <Section title="Practice plans">
        {view.length ? (
          <ul className="grid gap-3" data-testid="plan-list">
            {view.map((p) => {
              const due = p.state === "active" && now() >= p.nextAt;
              return (
                <li key={p.id} className="rounded-[16px] border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold">
                      #{p.id} · {LANES[p.lane]?.symbol} · {fmt(p.perBuy)} USDC every {span(p.interval)}
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
                    <button
                      type="button"
                      className="btn btn-ink btn-sm"
                      disabled={!due || busy !== null}
                      onClick={() =>
                        act("Run due buy", (b, t) => {
                          const o = runPlan(b, p.id, price(p.lane) ?? 0, t);
                          return o === "filled" ? `Plan #${p.id} bought (practice).` : o === "guarded" ? `Plan #${p.id} paused by its drawdown guard.` : `Plan #${p.id} paused at its target.`;
                        })
                      }
                      data-testid={`plan-run-${p.id}`}
                    >
                      Run due buy
                    </button>
                    {p.state === "active" ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act("Hold plan", (b, t) => setPlanState(b, p.id, "held", t))}>
                        Hold
                      </button>
                    ) : null}
                    {["held", "guarded", "targeted"].includes(p.state) ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act("Resume plan", (b, t) => setPlanState(b, p.id, "active", t))}>
                        Resume
                      </button>
                    ) : null}
                    {p.state !== "closed" ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => act("Close plan", (b, t) => setPlanState(b, p.id, "closed", t))}>
                        Close
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No practice plans yet. The form on the left opens one.</Empty>
        )}
        <p className="hint mt-4">Practice buys run when you press Run (use +1 h / +1 day above to move the practice clock).</p>
      </Section>
    </div>
  );
}
