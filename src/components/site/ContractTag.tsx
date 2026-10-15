"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { BRAND, TOKEN, explorerToken, isAddress, shortAddress } from "@/config/brand";

/*
 * The token address, from BRAND.ca only. Three shapes of one component:
 *   bar    navbar pill on the dark header ("$OSCRA AbCd…pump" + copy; on phones a short "CA" chip)
 *   slab   full address block (footer, token page)
 * Before launch it reads "At launch" and the copy control is disabled.
 */
function useCopy() {
  const [done, setDone] = useState(false);
  const copy = async () => {
    if (!isAddress(BRAND.ca)) return;
    try {
      await navigator.clipboard.writeText(BRAND.ca);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      // clipboard refused; the address stays visible
    }
  };
  return { done, copy };
}

export function ContractTag({ shape }: { shape: "bar" | "slab" }) {
  const { done, copy } = useCopy();
  const live = TOKEN.isLive;
  if (shape === "bar") {
    return (
      <button
        type="button"
        onClick={copy}
        disabled={!live}
        title={live ? `Copy the ${BRAND.symbol} contract address` : `${BRAND.symbol} contract address: at launch`}
        aria-label={live ? `Copy the ${BRAND.symbol} contract address ${BRAND.ca}` : `${BRAND.symbol} contract address not published yet`}
        className="inline-flex h-[32px] items-center gap-2 rounded-full border border-white/12 px-3 text-[11.5px] text-night-ink transition-colors enabled:hover:border-lime disabled:cursor-not-allowed"
        data-testid="ca-bar"
      >
        <span className="font-semibold text-lime">
          <span className="sm:hidden">CA</span>
          <span className="hidden sm:inline">{BRAND.symbol}</span>
        </span>
        <span className="hidden font-mono text-night-mute sm:inline">{live ? shortAddress(BRAND.ca, 4, 4) : "At launch"}</span>
        {live ? done ? <Check size={12} className="text-lime" /> : <Copy size={12} className="text-night-mute" /> : null}
      </button>
    );
  }
  return (
    <div className="rounded-[16px] border border-line bg-card p-4" data-testid="ca-slab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">{BRAND.symbol} mint · {BRAND.chainName}</span>
        {live ? (
          <a href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-olive">
            Explorer <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{live ? BRAND.ca : "Contract address coming soon"}</code>
        <button type="button" onClick={copy} disabled={!live} className="btn btn-ink btn-sm shrink-0" data-testid="ca-copy">
          {done ? <Check size={13} /> : <Copy size={13} />} {live ? (done ? "Copied" : "Copy") : "At launch"}
        </button>
      </div>
    </div>
  );
}
