"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { BRAND, TOKEN } from "@/config/brand";

/** Name, symbol and supply read from the token mint once its address is published. */
export function TokenFacts() {
  const { facts } = useChain();
  const t = facts?.token;
  const supply = t?.supply && t.decimals != null ? (Number(BigInt(t.supply) / 10n ** BigInt(Math.max(0, t.decimals - 2))) / 100).toLocaleString("en-US") : null;
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
      {[
        ["Name", TOKEN.isLive ? (t?.name ?? "…") : BRAND.name],
        ["Symbol", TOKEN.isLive ? (t?.symbol ?? "…") : BRAND.ticker],
        ["Supply", TOKEN.isLive ? (supply ?? "…") : "At launch"],
      ].map(([k, v]) => (
        <div key={k} className="min-w-0 bg-card px-4 py-3">
          <p className="label">{k}</p>
          <p className="num mt-1 truncate text-[14px]">{v}</p>
        </div>
      ))}
    </div>
  );
}
