"use client";

import { useEffect, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, NumberInput, Section, fmt } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, isAddress } from "@/config/brand";
import { CONTRACTS, keelLive } from "@/config/contracts";
import { KEEL_TERMS, RUNBOOK_TERMS } from "@/config/lanes";
import { ERC20_ABI, KEEL_ABI } from "@/lib/abi";
import { readKeel, readPollText, type KeelState } from "@/lib/live";
import { span } from "@/lib/format";

const tok = (v: bigint | null) => (v === null ? "–" : fmt(Number(v) / 1e18, 0));

export function StakeDesk() {
  const { send, busy, tick, now } = useWorkspace();
  const { address } = useWallet();
  const [s, setS] = useState<KeelState | null>(null);
  const [text, setText] = useState<Record<number, { title: string; choices: string[] }>>({});
  const [amount, setAmount] = useState("");
  const [poll, setPoll] = useState({ title: "", choices: "Yes\nNo", days: "5" });
  const token = isAddress(BRAND.ca) ? BRAND.ca : null;

  useEffect(() => {
    if (!keelLive()) return;
    let off = false;
    readKeel(address, token).then((v) => !off && setS(v)).catch(() => {});
    readPollText().then((v) => !off && setText(v)).catch(() => {});
    return () => {
      off = true;
    };
  }, [address, token, tick]);

  if (!keelLive()) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Staking opens after the token launches">
          <p className="text-[14.5px] text-ink-2">
            The staking contract, OscraKeel, needs the {BRAND.symbol} address in its constructor, so it is deployed after launch. Until then there is nothing to stake and the Runbook charges no fee
            at all.
          </p>
          <ul className="mt-4 space-y-2 text-[13.5px] text-ink-2">
            <li>Stake {BRAND.symbol} to receive a pro-rata share of every USDG fee the Runbook collects.</li>
            <li>Holding or staking {fmt(Number(RUNBOOK_TERMS.holderMin / 10n ** 18n), 0)} {BRAND.symbol} lowers your fee from {RUNBOOK_TERMS.feeBps / 100}% to {RUNBOOK_TERMS.holderFeeBps / 100}%.</li>
            <li>Stakers vote in polls; {fmt(Number(KEEL_TERMS.proposerMin / 10n ** 18n), 0)} staked opens one. A vote locks that stake until the poll ends.</li>
          </ul>
          <p className="hint mt-4">Thresholds assume a one-billion supply and can be set differently at deployment. Polls are advisory: the contracts have no admin, so results shape the next version.</p>
        </Section>
        <Section title="Status">
          <Empty>OscraKeel: not deployed. {BRAND.symbol}: {token ? "launched" : "not launched yet"}.</Empty>
        </Section>
      </div>
    );
  }

  const parsed = (() => {
    try {
      return amount.trim() ? parseUnits(amount.trim(), 18) : 0n;
    } catch {
      return 0n;
    }
  })();
  const locked = s ? s.lockedUntil > now() : false;
  const choices = poll.choices.split("\n").map((c) => c.trim()).filter(Boolean);
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Section title={`Stake ${BRAND.symbol}`}>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Your stake", tok(s?.staked ?? null)],
            ["All stakes", tok(s?.total ?? null)],
            ["Claimable USDG", s?.claimable == null ? "–" : fmt(Number(s.claimable) / 1e6)],
            ["In wallet", tok(s?.tokenBalance ?? null)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[14px] bg-card-2 p-3">
              <p className="label">{k}</p>
              <p className="num mt-1 text-[18px]">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 max-w-[320px]">
          <Field label={`Amount (${BRAND.symbol})`}>
            <NumberInput value={amount} onChange={setAmount} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {token && (s?.tokenAllowance ?? 0n) < parsed ? (
            <button type="button" className="btn btn-lime" disabled={busy !== null} onClick={() => send("Approve stake", token, encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.keel as `0x${string}`, parsed] }))}>
              Approve
            </button>
          ) : null}
          <button type="button" className="btn btn-ink" disabled={!parsed || busy !== null || !address} onClick={() => send("Stake", CONTRACTS.keel, encodeFunctionData({ abi: KEEL_ABI, functionName: "stake", args: [parsed] }))}>
            Stake
          </button>
          <button type="button" className="btn btn-ghost" disabled={!parsed || busy !== null || !address || locked} onClick={() => send("Unstake", CONTRACTS.keel, encodeFunctionData({ abi: KEEL_ABI, functionName: "unstake", args: [parsed] }))}>
            Unstake
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy !== null || !address || !s?.claimable} onClick={() => send("Claim fees", CONTRACTS.keel, encodeFunctionData({ abi: KEEL_ABI, functionName: "claim" }))}>
            Claim USDG
          </button>
        </div>
        {locked && s ? <p className="hint">Locked for {span(s.lockedUntil - now())} by a poll you voted in.</p> : null}
      </Section>
      <Section title="Polls">
        {s?.polls.length ? (
          <ul className="grid gap-3">
            {s.polls.map((p) => {
              const total = p.tallies.reduce((a, b) => a + b, 0n);
              const open = now() < p.end;
              return (
                <li key={p.id} className="rounded-[16px] border border-line p-4 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{text[p.id]?.title ?? `Poll #${p.id}`}</span>
                    <span className="chip bg-card-2 text-mute">{open ? `closes in ${span(p.end - now())}` : "closed"}</span>
                  </div>
                  <ul className="mt-3 grid gap-2">
                    {p.tallies.map((v, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{text[p.id]?.choices[i] ?? `Choice ${i + 1}`}</span>
                        <span className="num text-mute">{total ? `${((Number(v) / Number(total)) * 100).toFixed(1)}%` : "0%"}</span>
                        {open && p.ballot === 0 ? (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null || !s.staked} onClick={() => send("Vote", CONTRACTS.keel, encodeFunctionData({ abi: KEEL_ABI, functionName: "vote", args: [BigInt(p.id), i] }))}>
                            Vote
                          </button>
                        ) : p.ballot === i + 1 ? (
                          <span className="chip chip-light-clear">your vote</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No polls yet.</Empty>
        )}
        <div className="mt-5 grid gap-3">
          <Field label="New poll title" hint={`Needs ${fmt(Number(KEEL_TERMS.proposerMin / 10n ** 18n), 0)} ${BRAND.symbol} staked; one open poll per author.`}>
            <input className="field" maxLength={200} value={poll.title} onChange={(e) => setPoll((x) => ({ ...x, title: e.target.value }))} />
          </Field>
          <Field label="Choices (one per line, 2 to 6)">
            <textarea className="field min-h-[90px]" value={poll.choices} onChange={(e) => setPoll((x) => ({ ...x, choices: e.target.value }))} />
          </Field>
          <Field label="Length (days, 1 to 14)">
            <NumberInput value={poll.days} onChange={(v) => setPoll((x) => ({ ...x, days: v }))} />
          </Field>
          <button
            type="button"
            className="btn btn-ink justify-self-start"
            disabled={busy !== null || !address || !poll.title.trim() || choices.length < 2 || choices.length > 6}
            onClick={() => send("Open poll", CONTRACTS.keel, encodeFunctionData({ abi: KEEL_ABI, functionName: "openPoll", args: [poll.title.trim(), choices, Math.round(Number(poll.days) * 86_400)] }))}
          >
            Open poll
          </button>
        </div>
      </Section>
    </div>
  );
}
