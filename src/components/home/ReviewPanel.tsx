"use client";

import { useEffect, useState } from "react";
import type { Review } from "@/lib/review";
import { LANES } from "@/config/lanes";
import { Spark } from "@/components/ui/Spark";

export function useReview(lane: number) {
  const [state, setState] = useState<{ lane: number; data: (Review & { cachedAt: number }) | null; error: string | null }>({ lane: -1, data: null, error: null });
  useEffect(() => {
    let off = false;
    fetch(`/api/review?lane=${lane}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "Review not available.");
        if (!off) setState({ lane, data: body, error: null });
      })
      .catch((e: Error) => !off && setState({ lane, data: null, error: e.message }));
    return () => {
      off = true;
    };
  }, [lane]);
  // A read for another lane is never shown while the new one loads.
  return state.lane === lane ? { data: state.data, error: state.error } : { data: null, error: null };
}

/** The live rule-based read for one lane, in the dark instrument style. */
export function ReviewPanel({ lane = 0, compact = false }: { lane?: number; compact?: boolean }) {
  const { data, error } = useReview(lane);
  const l = LANES[lane];
  return (
    <div className="panel overflow-hidden" data-testid="review-panel">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Trade review · {l.symbol}</p>
          <p className="truncate text-[12px] text-night-mute">{data ? data.source : "Reading price history"}</p>
        </div>
        {data ? <span className="chip chip-clear num">{data.score} / 5 clear</span> : null}
      </div>
      {error ? <p className="px-5 py-6 text-[13px] text-night-mute">{error} The rest of the workspace keeps working.</p> : null}
      {data ? (
        <>
          <div className="px-5 pt-4">
            <Spark values={data.spark} className="h-[64px] w-full" stroke="var(--lime)" />
          </div>
          <ul className="mt-2">
            {data.checks.map((c) => (
              <li key={c.key} className="panel-row flex items-start justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{c.label}</span>
                  {compact ? null : <span className="block text-[12px] leading-snug text-night-mute">{c.note}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`chip chip-${c.verdict}`}>{c.verdict === "clear" ? "Clear" : c.verdict === "watch" ? "Watch" : "Against"}</span>
                  <span className="num text-[11.5px] text-night-mute">{c.value}</span>
                </span>
              </li>
            ))}
          </ul>
          {compact ? null : (
            <div className="panel-row space-y-1.5 px-5 py-4 text-[13px] leading-relaxed text-night-ink/85">
              {data.summary.map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
          )}
          <p className="panel-row px-5 py-3 font-mono text-[10.5px] text-night-mute">Rule-based read from live data · refreshed every 5 minutes · not advice</p>
        </>
      ) : error ? null : (
        <p className="px-5 py-8 text-[13px] text-night-mute">Loading the read…</p>
      )}
    </div>
  );
}
