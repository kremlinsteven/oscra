"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { CHAIN, explorerAddress, shortAddress } from "@/config/brand";
import { CONTRACTS, runbookLive } from "@/config/contracts";
import { LANES } from "@/config/lanes";
import { ago } from "@/lib/format";

const SHOWN = [0, 1, 2, 6, 4];

/** Hero instrument: live Robinhood Chain facts and the Chainlink price of five lanes, read every 12 seconds. */
export function LivePanel() {
  const { facts, failed } = useChain();
  const price = (id: number) => facts?.prices.find((p) => p.id === id) ?? null;
  return (
    <div className="panel overflow-hidden" data-testid="live-panel">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Runbook monitor</p>
          <p className="text-[12px] text-night-mute">{CHAIN.name} · chain {CHAIN.id}</p>
        </div>
        <span className={`chip ${failed ? "chip-against" : "chip-clear"}`}>
          <span className={`size-1.5 rounded-full ${failed ? "bg-[#f48a76]" : "pulse bg-lime"}`} />
          {failed ? "Chain unreachable" : facts ? "Live" : "Reading"}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-px bg-night-line">
        {[
          ["Block", facts?.block ? facts.block.toLocaleString("en-US") : "…"],
          ["Gas", facts?.gasGwei != null ? `${facts.gasGwei.toFixed(3)} gwei` : "…"],
          ["Pace", facts?.blockPace != null ? `${facts.blockPace.toFixed(2)} s` : "…"],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 bg-night px-4 py-3">
            <p className="label">{k}</p>
            <p className="num mt-1 truncate text-[15px]">{v}</p>
          </div>
        ))}
      </div>
      <ul>
        {SHOWN.map((id) => {
          const lane = LANES[id];
          const p = price(id);
          return (
            <li key={id} className="panel-row flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="min-w-0">
                <span className="text-[13.5px] font-semibold">{lane.symbol}</span>
                <span className="ml-2 text-[12px] text-night-mute">{lane.name}</span>
              </span>
              <span className="text-right">
                <span className="num block text-[14px]">{p?.price != null ? `$${p.price.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : "…"}</span>
                <span className="block text-[10.5px] text-night-mute">{p?.updatedAt ? `feed ${ago(p.updatedAt)}` : "Chainlink"}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="panel-row px-5 py-3 text-[12px] text-night-mute">
        {runbookLive() ? (
          <>
            OscraRunbook live at{" "}
            <a className="font-mono text-lime underline" href={explorerAddress(CONTRACTS.runbook)} target="_blank" rel="noreferrer">
              {shortAddress(CONTRACTS.runbook)}
            </a>
            {facts?.runbook.plans != null ? ` · ${facts.runbook.plans} plans · ${facts.runbook.signals ?? 0} ideas` : ""}
          </>
        ) : (
          "OscraRunbook is not deployed yet: the workspace runs in practice mode on these live prices."
        )}
      </div>
    </div>
  );
}
