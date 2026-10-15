"use client";

import { useEffect, useState } from "react";
import { encodeFunctionData } from "viem";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, LaneSelect, NumberInput, Section, fmt, n, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explorerAddress, isAddress, shortAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { LANES, LIMITS } from "@/config/lanes";
import { ERC20_ABI, RUNBOOK_ABI } from "@/lib/abi";
import { readFollows, readWallet, type ChainFollow, type ChainSignal } from "@/lib/live";
import { PRACTICE_DESK, copyWindow, follow as followDesk, mirror, post, skip, unfollow, type Follow } from "@/lib/practice";
import { span } from "@/lib/format";

type Terms = { perSignal: string; dayCap: string; maxCost: string; delayH: string; slip: string; chase: string; stop: string; tip: string };
const micro = (x: number) => BigInt(Math.round(x * 1e6));
const ALL = (1 << LANES.length) - 1;

export function CopyDesk() {
  const { live, book, act, now, price, send, busy, tick } = useWorkspace();
  const { address } = useWallet();
  const [leader, setLeader] = useState("");
  const [mask, setMask] = useState(ALL);
  const [t, setT] = useState<Terms>({ perSignal: "100", dayCap: "300", maxCost: "1000", delayH: "1", slip: "1.5", chase: "2", stop: "20", tip: "0" });
  const [idea, setIdea] = useState({ lane: 1, sell: false, weight: "100" });
  const [follows, setFollows] = useState<ChainFollow[]>([]);
  const [signals, setSignals] = useState<ChainSignal[]>([]);
  const [assetAllow, setAssetAllow] = useState<(bigint | null)[]>([]);

  useEffect(() => {
    if (!live || !address) return;
    let off = false;
    readFollows(address)
      .then((r) => {
        if (off) return;
        setFollows(r.follows);
        setSignals(r.signals);
      })
      .catch(() => {});
    readWallet(address).then((w) => !off && setAssetAllow(w.assetAllowance)).catch(() => {});
    return () => {
      off = true;
    };
  }, [live, address, tick]);

  const set = (k: keyof Terms) => (v: string) => setT((x) => ({ ...x, [k]: v }));
  const terms = {
    perSignal: n(t.perSignal),
    dayCap: n(t.dayCap),
    maxCost: t.maxCost.trim() ? n(t.maxCost) : 0,
    laneMask: mask,
    reviewDelay: Math.round(n(t.delayH) * 3600),
    slipBps: Math.round(n(t.slip) * 100),
    chaseBps: Math.round(n(t.chase) * 100),
    stopBps: t.stop.trim() ? Math.round(n(t.stop) * 100) : 0,
    tip: t.tip.trim() ? n(t.tip) : 0,
  };
  const valid = Object.values(terms).every(Number.isFinite) && mask > 0;
  const target = live ? leader.trim() : PRACTICE_DESK;
  const leaderOk = live ? isAddress(target) && target.toLowerCase() !== address?.toLowerCase() : true;

  function submitFollow() {
    if (!live) {
      act("Follow", (b, now) => followDesk(b, PRACTICE_DESK, terms, now));
      return;
    }
    send(
      "Follow desk",
      CONTRACTS.runbook,
      encodeFunctionData({
        abi: RUNBOOK_ABI,
        functionName: "follow",
        args: [target, { perSignal: micro(terms.perSignal), dayCap: micro(terms.dayCap), maxCost: micro(terms.maxCost), laneMask: mask, reviewDelay: terms.reviewDelay, slipBps: terms.slipBps, chaseBps: terms.chaseBps, stopBps: terms.stopBps, tip: micro(terms.tip) }],
      }),
    );
  }

  function postIdea() {
    const w = Math.round(n(idea.weight) * 100);
    if (!live) {
      act("Post idea", (b, now) => {
        post(b, PRACTICE_DESK, idea.lane, idea.sell, w, price(idea.lane) ?? 0, now);
        return "The practice desk posted an idea. It appears in your inbox below.";
      });
      return;
    }
    send("Post idea", CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "post", args: [idea.lane, idea.sell, w] }));
  }

  // One shape for both modes.
  type Row = { id: number; leader: string; lane: number; sell: boolean; weightBps: number; at: number; price: number; state: string; opens: number; closes: number };
  const rows: Row[] = live
    ? signals.map((s) => {
        const f = follows.find((x) => x.leader.toLowerCase() === s.leader.toLowerCase());
        const opens = s.at + (f?.reviewDelay ?? 0);
        return { id: s.id, leader: s.leader, lane: s.lane, sell: s.sell, weightBps: s.weightBps, at: s.at, price: Number(s.price) / 1e8, state: s.handled ? "handled" : !f?.active || s.at < (f?.since ?? 0) ? "not followed then" : "open", opens, closes: opens + LIMITS.mirrorWindowH * 3600 };
      })
    : book.signals
        .slice()
        .reverse()
        .map((s) => {
          const f = book.follows[s.leader] as Follow | undefined;
          const [opens, closes] = f ? copyWindow(s, f) : [s.at, s.at];
          return { ...s, state: book.handled[s.id] ?? (!f?.active || s.at < f.since ? "not followed then" : "open"), opens, closes };
        });

  function copyNow(r: Row) {
    if (!live) {
      act(`Copy idea #${r.id}`, (b, now) => {
        const o = mirror(b, r.id, price(r.lane) ?? 0, now);
        return o === "stopped" ? "Your stop ended this follow: the copied position fell past your limit." : `Idea #${r.id} copied (practice).`;
      });
      return;
    }
    send(`Copy idea #${r.id}`, CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "mirror", args: [address as `0x${string}`, BigInt(r.id)] }));
  }
  function skipIdea(id: number) {
    if (!live) return act(`Skip idea #${id}`, (b, now) => skip(b, id, now));
    send(`Skip idea #${id}`, CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "skip", args: [BigInt(id)] }));
  }

  const followView = live
    ? follows.map((f) => ({ leader: f.leader, active: f.active, perSignal: Number(f.perSignal) / 1e6, dayCap: Number(f.dayCap) / 1e6, daySpent: Number(f.daySpent) / 1e6, delay: f.reviewDelay, holdings: f.holdings.map((h) => ({ lane: h.lane, qty: Number(h.qty) / 1e18, cost: Number(h.cost) / 1e6 })) }))
    : Object.entries(book.follows).map(([leader, f]) => ({
        leader,
        active: f.active,
        perSignal: f.perSignal,
        dayCap: f.dayCap,
        daySpent: f.daySpent,
        delay: f.reviewDelay,
        holdings: Object.entries(book.holdings[leader] ?? {})
          .map(([lane, h]) => ({ lane: Number(lane), qty: h.qty, cost: h.cost }))
          .filter((h) => h.qty > 0),
      }));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid min-w-0 content-start gap-5">
        <Section title="Follow a desk">
          {live ? (
            <Field label="Desk wallet address" hint="Any wallet that posts ideas to the Runbook. You copy only what it posts after you follow.">
              <input className="field font-mono" value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="follow-leader" />
            </Field>
          ) : (
            <p className="rounded-[12px] bg-card-2 p-3 text-[13px] text-ink-2">Practice follows the practice desk: a placeholder you control from the box below. It has no history and no track record.</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Per idea (USDG)" hint="A buy idea spends this × its weight.">
              <NumberInput value={t.perSignal} onChange={set("perSignal")} testId="follow-size" />
            </Field>
            <Field label="Daily cap (USDG)">
              <NumberInput value={t.dayCap} onChange={set("dayCap")} />
            </Field>
            <Field label="Position cap per market (USDG)" hint="0 = none.">
              <NumberInput value={t.maxCost} onChange={set("maxCost")} />
            </Field>
            <Field label="Review delay (hours)" hint={`Ideas wait this long so you can skip them; then a ${LIMITS.mirrorWindowH}-hour copy window.`}>
              <NumberInput value={t.delayH} onChange={set("delayH")} testId="follow-delay" />
            </Field>
            <Field label="Slippage limit (%)">
              <NumberInput value={t.slip} onChange={set("slip")} />
            </Field>
            <Field label="Chase limit (%)" hint="Skip if price moved this far past the desk's price.">
              <NumberInput value={t.chase} onChange={set("chase")} />
            </Field>
            <Field label="Stop (%)" hint="End the follow if the copied position is down this much.">
              <NumberInput value={t.stop} onChange={set("stop")} />
            </Field>
            <Field label="Keeper tip (USDG)">
              <NumberInput value={t.tip} onChange={set("tip")} />
            </Field>
          </div>
          <fieldset className="mt-4">
            <legend className="field-label">Markets to copy</legend>
            <div className="flex flex-wrap gap-2">
              {LANES.map((l) => (
                <button key={l.id} type="button" onClick={() => setMask((m) => m ^ (1 << l.id))} className={`chip border ${mask & (1 << l.id) ? "border-ink bg-ink text-white" : "border-line-2 text-mute"}`}>
                  {l.symbol}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="btn btn-ink mt-5" disabled={!valid || !leaderOk || busy !== null || (live && !address)} onClick={submitFollow} data-testid="follow-submit">
            {live ? "Follow (wallet)" : "Follow the practice desk"}
          </button>
        </Section>

        <Section title={live ? "Post an idea as a desk" : "Practice desk: post an idea"}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Market">
              <LaneSelect value={idea.lane} onChange={(v) => setIdea((x) => ({ ...x, lane: v }))} />
            </Field>
            <Field label="Side">
              <select className="field" value={idea.sell ? "sell" : "buy"} onChange={(e) => setIdea((x) => ({ ...x, sell: e.target.value === "sell" }))}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </Field>
            <Field label="Weight (%)">
              <NumberInput value={idea.weight} onChange={(v) => setIdea((x) => ({ ...x, weight: v }))} />
            </Field>
          </div>
          <button type="button" className="btn btn-ghost mt-4" disabled={busy !== null || !(n(idea.weight) > 0 && n(idea.weight) <= 100) || (live && !address)} onClick={postIdea} data-testid="idea-post">
            Post idea
          </button>
          <p className="hint">The feed price at posting time is stored with the idea. Followers&apos; chase limits are measured from it.</p>
        </Section>
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <Section title="Ideas inbox">
          {rows.length ? (
            <ul className="grid gap-3" data-testid="idea-list">
              {rows.slice(0, 20).map((r) => {
                const tNow = now();
                const waiting = r.state === "open" && tNow < r.opens;
                const closed = r.state === "open" && tNow > r.closes;
                const sellNeedsApproval = live && r.sell && (assetAllow[r.lane] ?? 0n) === 0n;
                return (
                  <li key={r.id} className="rounded-[16px] border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold">
                        #{r.id} · {r.sell ? "Sell" : "Buy"} {LANES[r.lane]?.symbol} · weight {r.weightBps / 100}%
                      </span>
                      <span className={`chip ${r.state === "copied" || r.state === "handled" ? "chip-light-clear" : r.state === "skipped" ? "bg-card-2 text-mute" : closed ? "bg-card-2 text-mute" : waiting ? "chip-light-watch" : r.state === "open" ? "chip-light-clear" : "bg-card-2 text-mute"}`}>
                        {r.state === "open" ? (waiting ? `Review: ${span(r.opens - tNow)}` : closed ? "Window closed" : `Copy window: ${span(r.closes - tNow)}`) : r.state === "handled" ? "Copied or skipped" : r.state}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-mute">
                      {r.leader === PRACTICE_DESK ? "Practice desk" : shortAddress(r.leader)} · desk price ${fmt(r.price)} · now ${fmt(price(r.lane) ?? NaN)}
                    </p>
                    {r.state === "open" && !closed ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sellNeedsApproval ? (
                          <button type="button" className="btn btn-lime btn-sm" disabled={busy !== null} onClick={() => send(`Approve ${LANES[r.lane].symbol}`, LANES[r.lane].asset, encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.runbook as `0x${string}`, 2n ** 255n] }))}>
                            Approve {LANES[r.lane].symbol} for sells
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-ink btn-sm" disabled={waiting || busy !== null || sellNeedsApproval} onClick={() => copyNow(r)} data-testid={`idea-copy-${r.id}`}>
                          Copy now
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => skipIdea(r.id)} data-testid={`idea-skip-${r.id}`}>
                          Skip
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>{live ? "No ideas from desks you follow yet." : "Follow the practice desk, then post an idea from the box on the left."}</Empty>
          )}
        </Section>
        <Section title="Your follows">
          {followView.length ? (
            <ul className="grid gap-3">
              {followView.map((f) => (
                <li key={f.leader} className="rounded-[16px] border border-line p-4 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {f.leader === PRACTICE_DESK ? (
                      <span className="font-semibold">Practice desk</span>
                    ) : (
                      <a href={explorerAddress(f.leader)} target="_blank" rel="noreferrer" className="font-mono font-semibold underline">
                        {shortAddress(f.leader)}
                      </a>
                    )}
                    <span className={`chip ${f.active ? "chip-light-clear" : "bg-card-2 text-mute"}`}>{f.active ? "Following" : "Stopped"}</span>
                  </div>
                  <p className="num mt-2 text-mute">
                    {fmt(f.perSignal)} per idea · {fmt(f.daySpent)} of {fmt(f.dayCap)} today · delay {span(f.delay)}
                  </p>
                  {f.holdings.length ? (
                    <p className="mt-2">
                      Copied: {f.holdings.map((h) => `${qtyFmt(h.qty)} ${LANES[h.lane].symbol} (cost ${fmt(h.cost)})`).join(", ")}
                    </p>
                  ) : null}
                  {f.active ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-3"
                      disabled={busy !== null}
                      onClick={() => (live ? send("Unfollow", CONTRACTS.runbook, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "unfollow", args: [f.leader as `0x${string}`] })) : act("Unfollow", (b, now) => unfollow(b, f.leader, now)))}
                    >
                      Unfollow
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Not following anyone yet.</Empty>
          )}
          <p className="hint mt-4">OSCRA shows no leaderboards or past returns for desks: there is no verified history to show yet. Judge a desk by what it posts after you follow, inside your caps.</p>
        </Section>
      </div>
    </div>
  );
}
