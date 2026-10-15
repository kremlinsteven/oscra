"use client";

import { useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { useMode, useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, LaneSelect, ModeTabs, NumberInput, Section, fmt, n, qtyFmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDC, explorerAddress, explorerTx, isAddress, shortAddress } from "@/config/brand";
import { LANES, LIMITS } from "@/config/lanes";
import { copyWindow as realWindow, holdingOf, planCopy, spentToday } from "@/lib/copy-rules";
import { span } from "@/lib/format";
import { b64ToBytes, quote, swapTransaction } from "@/lib/jupiter";
import { PRACTICE_DESK, copyWindow, follow as followDesk, mirror, post, skip, unfollow, type Follow } from "@/lib/practice";
import type { FollowTerms } from "@/lib/records-shared";

type Terms = { perSignal: string; dayCap: string; maxCost: string; delayH: string; slip: string; chase: string; stop: string };
const ALL = (1 << LANES.length) - 1;

export function CopyDesk() {
  const [mode, setMode] = useMode("copy");
  return (
    <>
      <ModeTabs
        mode={mode}
        setMode={setMode}
        realLabel="Real: wallet swaps"
        note={mode === "real" ? "Follows and ideas are wallet-signed records. Each copy is a Jupiter swap you confirm; your limits are checked first." : "A practice desk you control, a simulated book, live prices."}
      />
      {mode === "real" ? <RealCopy /> : <PracticeCopy />}
    </>
  );
}

function useTerms() {
  const [mask, setMask] = useState(ALL);
  const [t, setT] = useState<Terms>({ perSignal: "100", dayCap: "300", maxCost: "1000", delayH: "1", slip: "1.5", chase: "2", stop: "20" });
  const set = (k: keyof Terms) => (v: string) => setT((x) => ({ ...x, [k]: v }));
  const terms: FollowTerms = {
    perSignal: n(t.perSignal),
    dayCap: n(t.dayCap),
    maxCost: t.maxCost.trim() ? n(t.maxCost) : 0,
    laneMask: mask,
    reviewDelay: Math.round(n(t.delayH) * 3600),
    slipBps: Math.round(n(t.slip) * 100),
    chaseBps: Math.round(n(t.chase) * 100),
    stopBps: t.stop.trim() ? Math.round(n(t.stop) * 100) : 0,
  };
  const valid = Object.values(terms).every(Number.isFinite) && mask > 0;
  return { t, set, mask, setMask, terms, valid };
}

function TermsForm({ f }: { f: ReturnType<typeof useTerms> }) {
  const { t, set, mask, setMask } = f;
  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Per idea (USDC)" hint="A buy idea spends this × its weight.">
          <NumberInput value={t.perSignal} onChange={set("perSignal")} testId="follow-size" />
        </Field>
        <Field label="Daily cap (USDC)">
          <NumberInput value={t.dayCap} onChange={set("dayCap")} />
        </Field>
        <Field label="Position cap per market (USDC)" hint="0 = none.">
          <NumberInput value={t.maxCost} onChange={set("maxCost")} />
        </Field>
        <Field label="Review delay (hours)" hint={`Ideas wait this long so you can skip them; then a ${LIMITS.mirrorWindowH}-hour copy window.`}>
          <NumberInput value={t.delayH} onChange={set("delayH")} testId="follow-delay" />
        </Field>
        <Field label="Slippage limit (%)" hint="0.5% to 5%, sent to Jupiter with the swap.">
          <NumberInput value={t.slip} onChange={set("slip")} />
        </Field>
        <Field label="Chase limit (%)" hint="Skip if price moved this far past the desk's price.">
          <NumberInput value={t.chase} onChange={set("chase")} />
        </Field>
        <Field label="Stop (%)" hint="Stop copying buys if the copied position is down this much.">
          <NumberInput value={t.stop} onChange={set("stop")} />
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
    </>
  );
}

function IdeaForm({ onPost, disabled, title, note }: { onPost: (lane: number, sell: boolean, weightBps: number) => void; disabled: boolean; title: string; note: string }) {
  const [idea, setIdea] = useState({ lane: 1, sell: false, weight: "100" });
  const ok = n(idea.weight) > 0 && n(idea.weight) <= 100;
  return (
    <Section title={title}>
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
      <button type="button" className="btn btn-ghost mt-4" disabled={disabled || !ok} onClick={() => onPost(idea.lane, idea.sell, Math.round(n(idea.weight) * 100))} data-testid="idea-post">
        Post idea
      </button>
      <p className="hint">{note}</p>
    </Section>
  );
}

function windowChip(state: string, waiting: boolean, closed: boolean, opens: number, closes: number, now: number) {
  const cls = state === "copied" ? "chip-light-clear" : state === "open" && !closed ? (waiting ? "chip-light-watch" : "chip-light-clear") : "bg-card-2 text-mute";
  const text = state === "open" ? (waiting ? `Review: ${span(opens - now)}` : closed ? "Window closed" : `Copy window: ${span(closes - now)}`) : state;
  return <span className={`chip ${cls}`}>{text}</span>;
}

/* ------------------------------------------------------------------ real */

function RealCopy() {
  const { board, record, sendTx, busy, price, wallet, notify, wallClock } = useWorkspace();
  const { address } = useWallet();
  const f = useTerms();
  const [leader, setLeader] = useState("");
  const target = leader.trim();
  const leaderOk = isAddress(target) && target !== address;
  const mine = board?.mine ?? null;
  const follows = mine?.follows ?? [];
  const ideas = board?.ideas ?? [];
  const fills = mine?.fills ?? [];
  const nowSec = wallClock();
  const followed = new Set(follows.map((x) => x.leader));
  const inbox = ideas.filter((i) => followed.has(i.leader) || i.leader === address).slice(0, 20);
  const disabled = !address || busy !== null;

  async function copy(ideaId: number) {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea || !address) return;
    const lane = LANES[idea.lane];
    const fw = follows.find((x) => x.leader === idea.leader);
    const walletQty = wallet?.assets[idea.lane] != null ? Number(wallet.assets[idea.lane]) / 10 ** lane.decimals : null;
    const plan = planCopy({ idea, follow: fw, handled: mine?.handled[idea.id], fills, ideas, price: price(idea.lane), walletQty, now: wallClock() });
    if (!plan.ok) return notify({ kind: "error", text: `Copy idea #${idea.id}: ${plan.reason}` });
    const usdcHave = wallet?.usdc != null ? Number(wallet.usdc) / 1e6 : null;
    if (plan.side === "buy" && usdcHave !== null && usdcHave < plan.usdc) return notify({ kind: "error", text: `Copy idea #${idea.id}: needs ${fmt(plan.usdc)} USDC, the wallet holds ${fmt(usdcHave)}.` });
    const sig = await sendTx(`Copy idea #${idea.id}`, async () => {
      const q =
        plan.side === "buy"
          ? await quote(USDC.mint, lane.mint, BigInt(Math.floor(plan.usdc * 1e6)), fw!.slipBps)
          : await quote(lane.mint, USDC.mint, BigInt(Math.floor(plan.qty * 10 ** lane.decimals)), fw!.slipBps);
      const { swapTransaction: tx } = await swapTransaction(address, q);
      return VersionedTransaction.deserialize(b64ToBytes(tx));
    });
    if (sig) await record(`Record copy #${idea.id}`, "record-fill", { signal: idea.id, signature: sig });
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid min-w-0 content-start gap-5">
        {board && !board.configured ? (
          <p className="rounded-[14px] border border-warn/40 bg-[#fbf3dc] p-3 text-[13px] text-ink-2" data-testid="records-notice">
            Records are not configured on this deployment yet: follows and ideas are kept in server memory and reset on restart. Swaps are unaffected.
          </p>
        ) : null}
        <Section title="Follow a desk">
          <Field label="Desk wallet address" hint="Any Solana wallet that posts ideas here. You copy only what it posts after you follow.">
            <input className="field font-mono" value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="Solana address" spellCheck={false} data-testid="follow-leader" />
          </Field>
          <TermsForm f={f} />
          <button type="button" className="btn btn-ink mt-5" disabled={!f.valid || !leaderOk || disabled} onClick={() => record("Follow desk", "follow", { leader: target, terms: f.terms })} data-testid="follow-submit">
            {address ? "Follow (sign with wallet)" : "Connect a wallet first"}
          </button>
          <p className="hint">Signing a follow costs nothing and moves no funds.</p>
        </Section>
        <IdeaForm
          title="Post an idea as a desk"
          disabled={disabled}
          onPost={(lane, sell, weightBps) => record("Post idea", "post-idea", { lane, sell, weightBps })}
          note="The server stores the live price at posting time with the idea; followers' chase limits are measured from it. Up to 20 ideas a day."
        />
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <Section title="Ideas inbox">
          {!address ? (
            <Empty>Connect a wallet to see ideas from the desks you follow.</Empty>
          ) : inbox.length ? (
            <ul className="grid gap-3" data-testid="idea-list">
              {inbox.map((r) => {
                const fw = follows.find((x) => x.leader === r.leader);
                const own = r.leader === address;
                const handled = mine?.handled[r.id];
                const [opens, closes] = fw ? realWindow(r, fw) : [r.at, r.at];
                const state: string = own ? "your idea" : handled ?? (!fw || r.at < fw.since ? "before your follow" : "open");
                const waiting = state === "open" && nowSec < opens;
                const closed = state === "open" && nowSec > closes;
                return (
                  <li key={r.id} className="rounded-[16px] border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold">
                        #{r.id} · {r.sell ? "Sell" : "Buy"} {LANES[r.lane]?.symbol} · weight {r.weightBps / 100}%
                      </span>
                      {windowChip(state, waiting, closed, opens, closes, nowSec)}
                    </div>
                    <p className="mt-1 text-[12.5px] text-mute">
                      {shortAddress(r.leader)} · desk price ${fmt(r.price)} · now ${fmt(price(r.lane) ?? NaN)}
                    </p>
                    {state === "open" && !closed ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-ink btn-sm" disabled={waiting || disabled} onClick={() => copy(r.id)} data-testid={`idea-copy-${r.id}`}>
                          Copy with Jupiter
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => record(`Skip idea #${r.id}`, "skip", { signal: r.id })}>
                          Skip
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No ideas from desks you follow yet.</Empty>
          )}
        </Section>
        <Section title="Your follows">
          {follows.length ? (
            <ul className="grid gap-3">
              {follows.map((fw) => {
                const holds = LANES.map((l) => ({ lane: l.id, ...holdingOf(fills, ideas, fw.leader, l.id) })).filter((h) => h.qty > 0);
                return (
                  <li key={fw.leader} className="rounded-[16px] border border-line p-4 text-[13.5px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a href={explorerAddress(fw.leader)} target="_blank" rel="noreferrer" className="font-mono font-semibold underline">
                        {shortAddress(fw.leader)}
                      </a>
                      <span className="chip chip-light-clear">Following</span>
                    </div>
                    <p className="num mt-2 text-mute">
                      {fmt(fw.perSignal)} per idea · {fmt(spentToday(fills, ideas, fw.leader, nowSec))} of {fmt(fw.dayCap)} today · delay {span(fw.reviewDelay)}
                    </p>
                    {holds.length ? <p className="mt-2">Copied: {holds.map((h) => `${qtyFmt(h.qty)} ${LANES[h.lane].symbol} (cost ${fmt(h.cost)})`).join(", ")}</p> : null}
                    <button type="button" className="btn btn-ghost btn-sm mt-3" disabled={disabled} onClick={() => record("Unfollow", "unfollow", { leader: fw.leader })}>
                      Unfollow
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>{address ? "Not following anyone yet." : "Connect a wallet to see your follows."}</Empty>
          )}
          {fills.length ? (
            <>
              <h3 className="label mt-5">Recorded copies</h3>
              <ul className="mt-2 grid gap-1 text-[12.5px] text-mute">
                {fills.slice(0, 8).map((x) => (
                  <li key={x.signature} className="num">
                    #{x.signal} {x.sell ? "sold" : "bought"} {qtyFmt(x.qty)} {LANES[x.lane].symbol} for {fmt(x.usdc)} USDC ·{" "}
                    <a className="underline" href={explorerTx(x.signature)} target="_blank" rel="noreferrer">
                      tx
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="hint mt-4">OSCRA shows no leaderboards or past returns for desks: there is no verified history to show yet. Judge a desk by what it posts after you follow, inside your caps.</p>
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ practice */

function PracticeCopy() {
  const { book, act, now, price, busy } = useWorkspace();
  const f = useTerms();
  const rows = book.signals
    .slice()
    .reverse()
    .map((s) => {
      const fw = book.follows[s.leader] as Follow | undefined;
      const [opens, closes] = fw ? copyWindow(s, fw) : [s.at, s.at];
      const state: string = book.handled[s.id] ?? (!fw?.active || s.at < fw.since ? "not followed then" : "open");
      return { ...s, state, opens, closes };
    });
  const followView = Object.entries(book.follows).map(([leader, fw]) => ({
    leader,
    ...fw,
    holdings: Object.entries(book.holdings[leader] ?? {})
      .map(([lane, h]) => ({ lane: Number(lane), qty: h.qty, cost: h.cost }))
      .filter((h) => h.qty > 0),
  }));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid min-w-0 content-start gap-5">
        <Section title="Follow the practice desk">
          <p className="rounded-[12px] bg-card-2 p-3 text-[13px] text-ink-2">Practice follows the practice desk: a placeholder you control from the box below. It has no history and no track record.</p>
          <TermsForm f={f} />
          <button type="button" className="btn btn-ink mt-5" disabled={!f.valid || busy !== null} onClick={() => act("Follow", (b, t) => followDesk(b, PRACTICE_DESK, f.terms, t))} data-testid="follow-submit">
            Follow the practice desk
          </button>
        </Section>
        <IdeaForm
          title="Practice desk: post an idea"
          disabled={busy !== null}
          onPost={(lane, sell, w) =>
            act("Post idea", (b, t) => {
              post(b, PRACTICE_DESK, lane, sell, w, price(lane) ?? 0, t);
              return "The practice desk posted an idea. It appears in your inbox.";
            })
          }
          note="The live price at posting time is stored with the idea. Your chase limit is measured from it."
        />
      </div>
      <div className="grid min-w-0 content-start gap-5">
        <Section title="Ideas inbox">
          {rows.length ? (
            <ul className="grid gap-3" data-testid="idea-list">
              {rows.slice(0, 20).map((r) => {
                const tNow = now();
                const waiting = r.state === "open" && tNow < r.opens;
                const closed = r.state === "open" && tNow > r.closes;
                return (
                  <li key={r.id} className="rounded-[16px] border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold">
                        #{r.id} · {r.sell ? "Sell" : "Buy"} {LANES[r.lane]?.symbol} · weight {r.weightBps / 100}%
                      </span>
                      {windowChip(r.state, waiting, closed, r.opens, r.closes, tNow)}
                    </div>
                    <p className="mt-1 text-[12.5px] text-mute">
                      Practice desk · desk price ${fmt(r.price)} · now ${fmt(price(r.lane) ?? NaN)}
                    </p>
                    {r.state === "open" && !closed ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-ink btn-sm"
                          disabled={waiting || busy !== null}
                          onClick={() =>
                            act(`Copy idea #${r.id}`, (b, t) => {
                              const o = mirror(b, r.id, price(r.lane) ?? 0, t);
                              return o === "stopped" ? "Your stop ended this follow: the copied position fell past your limit." : `Idea #${r.id} copied (practice).`;
                            })
                          }
                          data-testid={`idea-copy-${r.id}`}
                        >
                          Copy now
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => act(`Skip idea #${r.id}`, (b, t) => skip(b, r.id, t))} data-testid={`idea-skip-${r.id}`}>
                          Skip
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>Follow the practice desk, then post an idea from the box on the left.</Empty>
          )}
        </Section>
        <Section title="Practice follows">
          {followView.length ? (
            <ul className="grid gap-3">
              {followView.map((fw) => (
                <li key={fw.leader} className="rounded-[16px] border border-line p-4 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Practice desk</span>
                    <span className={`chip ${fw.active ? "chip-light-clear" : "bg-card-2 text-mute"}`}>{fw.active ? "Following" : "Stopped"}</span>
                  </div>
                  <p className="num mt-2 text-mute">
                    {fmt(fw.perSignal)} per idea · {fmt(fw.daySpent)} of {fmt(fw.dayCap)} today · delay {span(fw.reviewDelay)}
                  </p>
                  {fw.holdings.length ? <p className="mt-2">Copied: {fw.holdings.map((h) => `${qtyFmt(h.qty)} ${LANES[h.lane].symbol} (cost ${fmt(h.cost)})`).join(", ")}</p> : null}
                  {fw.active ? (
                    <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => act("Unfollow", (b, t) => unfollow(b, fw.leader, t))}>
                      Unfollow
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Not following the practice desk yet.</Empty>
          )}
        </Section>
      </div>
    </div>
  );
}
