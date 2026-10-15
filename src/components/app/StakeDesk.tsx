"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/app/Workspace";
import { Empty, Field, NumberInput, Section, fmt, n } from "@/components/app/bits";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, TOKEN, TOKEN_DECIMALS } from "@/config/brand";
import { PRACTICE_TERMS } from "@/config/lanes";
import { span } from "@/lib/format";
import { claim, feeRate, stake, unstake } from "@/lib/practice";

export function StakeDesk() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <PracticeStake />
      <Polls />
    </div>
  );
}

function PracticeStake() {
  const { book, act, busy } = useWorkspace();
  const [amount, setAmount] = useState("");
  const a = n(amount);
  const s = book.stake;
  return (
    <Section title={`Stake ${BRAND.symbol} (practice)`} aside={<span className="chip chip-light-watch">practice: no funds move</span>}>
      <p className="text-[13.5px] text-ink-2">
        There is no on-chain staking contract. Fee share and the holder discount run here as practice with your practice book: practice plans and copies pay a practice fee ({PRACTICE_TERMS.feeBps / 100}%, or{" "}
        {PRACTICE_TERMS.holderFeeBps / 100}% when you hold or stake {fmt(PRACTICE_TERMS.holderMin, 0)} practice {BRAND.symbol}) into a pool that stakers claim. Real Jupiter orders pay no OSCRA fee.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          ["Practice wallet", fmt(s.wallet, 0)],
          ["Staked", fmt(s.staked, 0)],
          ["Fee pool (USDC)", fmt(s.pool)],
          ["Your rate", `${feeRate(book) / 100}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[14px] bg-card-2 p-3">
            <p className="label">{k}</p>
            <p className="num mt-1 text-[18px]">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 max-w-[320px]">
        <Field label={`Amount (practice ${BRAND.symbol})`}>
          <NumberInput value={amount} onChange={setAmount} testId="stake-amount" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ink" disabled={!(a > 0) || busy !== null} onClick={() => act("Stake", (b, t) => stake(b, a, t))} data-testid="stake-practice">
          Stake
        </button>
        <button type="button" className="btn btn-ghost" disabled={!(a > 0) || busy !== null} onClick={() => act("Unstake", (b, t) => unstake(b, a, t))}>
          Unstake
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => act("Claim fee share", (b, t) => claim(b, t))}>
          Claim
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            act("Add practice tokens", (b) => {
              b.stake.wallet += 100_000;
              return `Added 100,000 practice ${BRAND.symbol}.`;
            })
          }
        >
          +100,000 practice {BRAND.symbol}
        </button>
      </div>
      <p className="hint mt-4">In practice you are the only staker, so the pool returns your own fees. Claimed so far: {fmt(s.claimed)} practice USDC.</p>
    </Section>
  );
}

function Polls() {
  const { board, record, busy, wallet, wallClock } = useWorkspace();
  const { address } = useWallet();
  const [poll, setPoll] = useState({ title: "", choices: "Yes\nNo", days: "5" });
  const nowSec = wallClock();
  const polls = board?.polls ?? [];
  const votes = board?.mine?.votes ?? {};
  const bal = wallet?.oscra != null ? Number(wallet.oscra) / 10 ** TOKEN_DECIMALS : null;
  const choices = poll.choices
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  const disabled = busy !== null || !address || !TOKEN.isLive;
  return (
    <Section title="Polls" aside={<span className="chip bg-card-2 text-mute">wallet-signed, advisory</span>}>
      <p className="text-[13.5px] text-ink-2">
        A vote is a free wallet signature. It weighs the {BRAND.symbol} your wallet holds at the moment you vote, read on-chain by the server; one vote per wallet per poll. Results are advisory and shape what OSCRA builds next.
      </p>
      {!TOKEN.isLive ? <p className="mt-3 rounded-[12px] bg-card-2 p-3 text-[13px] text-mute" data-testid="polls-closed">Polls open once {BRAND.symbol} is live on pump.fun.</p> : null}
      {bal !== null ? <p className="num mt-3 text-[13px] text-mute">Your voting weight now: {fmt(bal, 2)} {BRAND.symbol}</p> : null}
      <div className="mt-4">
        {polls.length ? (
          <ul className="grid gap-3">
            {polls.map((p) => {
              const total = p.tally.reduce((x, y) => x + y, 0);
              const open = nowSec < p.end;
              const mine = votes[p.id];
              return (
                <li key={p.id} className="rounded-[16px] border border-line p-4 text-[13.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 font-semibold break-words">{p.title}</span>
                    <span className="chip bg-card-2 text-mute">{open ? `closes in ${span(p.end - nowSec)}` : "closed"}</span>
                  </div>
                  <ul className="mt-3 grid gap-2">
                    {p.choices.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{c}</span>
                        <span className="num text-mute">{total ? `${((p.tally[i] / total) * 100).toFixed(1)}%` : "0%"}</span>
                        {open && mine === undefined ? (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => record("Vote", "vote", { poll: p.id, choice: i })}>
                            Vote
                          </button>
                        ) : mine === i ? (
                          <span className="chip chip-light-clear">your vote</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] text-mute">{p.voters} wallets voted</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No polls yet.</Empty>
        )}
      </div>
      <div className="mt-5 grid gap-3">
        <Field label="New poll title" hint={`Needs ${fmt(PRACTICE_TERMS.proposerMin, 0)} ${BRAND.symbol} in the wallet; one open poll per author.`}>
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
          disabled={disabled || !poll.title.trim() || choices.length < 2 || choices.length > 6}
          onClick={() => record("Open poll", "open-poll", { title: poll.title.trim(), choices, days: Math.round(Number(poll.days)) })}
        >
          Open poll (sign)
        </button>
      </div>
    </Section>
  );
}
