"use client";

import { useState } from "react";
import { encodeAbiParameters, encodeFunctionData, type Hex } from "viem";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, CHAIN, SWAP_ROUTER, USDG, explorerAddress, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { KEEL_TERMS, LANES, RUNBOOK_TERMS } from "@/config/lanes";
import { storageKey } from "@/config/storage";
import { RUNBOOK_ABI } from "@/lib/abi";
import { explain, waitForReceipt } from "@/lib/client";

type Art = { creation: string; sha256: string };
type Progress = { runbook?: string; runbookTx?: string; runbookBlock?: number; keel?: string; keelTx?: string; bound?: string };

const LANE_TUPLE = { type: "tuple[]", components: [{ type: "address", name: "asset" }, { type: "uint24", name: "poolFee" }, { type: "address", name: "feed" }, { type: "uint32", name: "maxAge" }] } as const;

export function DeployPanel({ runbook, keel }: { runbook: Art; keel: Art }) {
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [p, setP] = useLocalStore<Progress>(storageKey("deploy", String(CHAIN.id)), {});
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l]);
  const tokenReady = isAddress(BRAND.ca);

  async function tx(label: string, to: string | undefined, data: Hex) {
    if (!onRobinhoodChain) await switchNetwork();
    say(`${label}: confirm in the wallet (${(data.length - 2) / 2} bytes)`);
    const hash = await sendTransaction({ to, data });
    say(`${label}: sent ${hash}`);
    const r = await waitForReceipt(hash, 300_000);
    if (!r.ok) throw new Error(`${label} reverted`);
    say(`${label}: confirmed in block ${r.blockNumber}${r.contractAddress ? `, contract ${r.contractAddress}` : ""}`);
    return { hash, block: r.blockNumber, address: r.contractAddress };
  }
  async function step(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      say(`${name} failed: ${explain(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const runbookArgs = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, LANE_TUPLE, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    [USDG.address, SWAP_ROUTER, LANES.map((l) => ({ asset: l.asset, poolFee: l.poolFee, feed: l.feed, maxAge: l.maxAge })), BigInt(RUNBOOK_TERMS.feeBps), BigInt(RUNBOOK_TERMS.holderFeeBps), RUNBOOK_TERMS.holderMin],
  );
  const rb = p.runbook ?? CONTRACTS.runbook;
  const kl = p.keel ?? CONTRACTS.keel;
  const snippet = `const DEPLOYED = {\n  runbook: "${rb}",\n  keel: "${kl}",\n  fromBlock: ${p.runbookBlock ?? CONTRACTS.fromBlock},\n};`;

  if (!address)
    return (
      <button type="button" onClick={open} className="btn btn-ink">
        Connect the deployer wallet
      </button>
    );

  const box = "card p-6";
  return (
    <div className="space-y-5">
      <section className={box}>
        <h2 className="text-[20px] font-semibold">1 · OscraRunbook</h2>
        <p className="mt-1 text-[14px] text-mute">
          Plans, desks and follows. No token needed: it can go live now. Fixed forever: USDG, SwapRouter02, {LANES.length} lanes ({LANES.map((l) => l.symbol).join(", ")}), fee {RUNBOOK_TERMS.feeBps} bps,
          holder fee {RUNBOOK_TERMS.holderFeeBps} bps, holder threshold {(RUNBOOK_TERMS.holderMin / 10n ** 18n).toLocaleString()} {BRAND.symbol}. Fees stay zero until step 3. This wallet becomes the
          one-time binder.
        </p>
        {p.runbook ? (
          <p className="mt-4 text-[14px] text-olive">
            Deployed at <a href={explorerAddress(p.runbook)} target="_blank" rel="noreferrer" className="font-mono underline">{p.runbook}</a> (block {p.runbookBlock})
          </p>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            className="btn btn-ink mt-4"
            onClick={() =>
              step("OscraRunbook", async () => {
                const r = await tx("OscraRunbook", undefined, (runbook.creation + runbookArgs.slice(2)) as Hex);
                setP((x) => ({ ...x, runbook: r.address ?? undefined, runbookTx: r.hash, runbookBlock: r.block }));
              })
            }
          >
            Deploy OscraRunbook (sha256 {runbook.sha256.slice(0, 10)}…)
          </button>
        )}
      </section>

      <section className={box}>
        <h2 className="text-[20px] font-semibold">2 · OscraKeel</h2>
        <p className="mt-1 text-[14px] text-mute">
          Staking, USDG fee share and polls. Constructor: the {BRAND.symbol} address, USDG, poll threshold {(KEEL_TERMS.proposerMin / 10n ** 18n).toLocaleString()} {BRAND.symbol}.
        </p>
        {!tokenReady ? <p className="mt-4 text-[14px] text-warn">Waiting for the token: set the real CA in src/config/brand.ts, rebuild, then come back.</p> : null}
        {p.keel ? (
          <p className="mt-4 text-[14px] text-olive">
            Deployed at <a href={explorerAddress(p.keel)} target="_blank" rel="noreferrer" className="font-mono underline">{p.keel}</a>
          </p>
        ) : (
          <button
            type="button"
            disabled={busy !== null || !tokenReady}
            className="btn btn-ink mt-4"
            onClick={() =>
              step("OscraKeel", async () => {
                const args = encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint256" }], [BRAND.ca as Hex, USDG.address, KEEL_TERMS.proposerMin]);
                const r = await tx("OscraKeel", undefined, (keel.creation + args.slice(2)) as Hex);
                setP((x) => ({ ...x, keel: r.address ?? undefined, keelTx: r.hash }));
              })
            }
          >
            Deploy OscraKeel
          </button>
        )}
      </section>

      <section className={box}>
        <h2 className="text-[20px] font-semibold">3 · Bind the Runbook to the Keel</h2>
        <p className="mt-1 text-[14px] text-mute">One call, once, from the wallet that deployed the Runbook. From then on fees apply and flow to stakers. It cannot be changed afterwards.</p>
        {p.bound ? (
          <p className="mt-4 text-[14px] text-olive">Bound (tx {p.bound.slice(0, 12)}…)</p>
        ) : (
          <button
            type="button"
            disabled={busy !== null || !isAddress(rb) || !isAddress(kl)}
            className="btn btn-ink mt-4"
            onClick={() =>
              step("bind", async () => {
                const r = await tx("bind", rb, encodeFunctionData({ abi: RUNBOOK_ABI, functionName: "bind", args: [kl as Hex] }));
                setP((x) => ({ ...x, bound: r.hash }));
              })
            }
          >
            Bind
          </button>
        )}
      </section>

      <section className={box}>
        <h2 className="text-[20px] font-semibold">4 · Paste into src/config/contracts.ts</h2>
        <pre className="mt-3 overflow-x-auto rounded-[14px] bg-night p-4 font-mono text-[12.5px] text-night-ink">{snippet}</pre>
        <p className="mt-3 text-[13px] text-mute">
          Then run{" "}
          <code className="font-mono break-all">
            npm run verify-deployment -- --runbook {rb || "0x…"} --runbook-tx {p.runbookTx ?? "0x…"}
            {p.keel ? ` --keel ${p.keel} --keel-tx ${p.keelTx} --token ${BRAND.ca}` : ""}
          </code>{" "}
          (it must print MATCH) and the Blockscout source verification.
        </p>
      </section>

      {log.length ? <pre className="max-h-64 overflow-auto rounded-[14px] border border-line bg-card p-4 font-mono text-[12px] text-mute" data-testid="deploy-log">{log.join("\n")}</pre> : null}
    </div>
  );
}
