"use client";

import { LANES } from "@/config/lanes";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="hint block">{hint}</span> : null}
    </label>
  );
}

export function NumberInput({ value, onChange, step = "any", min, testId }: { value: string; onChange: (v: string) => void; step?: string; min?: number; testId?: string }) {
  return <input type="number" inputMode="decimal" className="field num" value={value} step={step} min={min} onChange={(e) => onChange(e.target.value)} data-testid={testId} />;
}

export function LaneSelect({ value, onChange, testId }: { value: number; onChange: (v: number) => void; testId?: string }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId}>
      {LANES.map((l) => (
        <option key={l.id} value={l.id}>
          {l.symbol} · {l.name}
        </option>
      ))}
    </select>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{title}</h2>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[14px] border border-dashed border-line-2 px-4 py-6 text-center text-[13.5px] text-mute">{children}</p>;
}

const STATE_STYLE: Record<string, string> = {
  active: "chip-light-clear",
  held: "chip-light-watch",
  guarded: "chip-light-against",
  targeted: "chip-light-watch",
  spent: "bg-card-2 text-mute",
  closed: "bg-card-2 text-mute",
};
const STATE_TEXT: Record<string, string> = {
  active: "Active",
  held: "Held by you",
  guarded: "Paused: drawdown guard",
  targeted: "Paused: target reached",
  spent: "Budget spent",
  closed: "Closed",
};
export function StateChip({ state }: { state: string }) {
  return <span className={`chip ${STATE_STYLE[state] ?? "bg-card-2"}`}>{STATE_TEXT[state] ?? state}</span>;
}

export const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
export const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
export const qtyFmt = (x: number) => (Number.isFinite(x) ? (x >= 1 ? x.toLocaleString("en-US", { maximumFractionDigits: 4 }) : x.toPrecision(4)) : "–");

/** Real / practice switch shown at the top of a screen. */
export function ModeTabs({ mode, setMode, realLabel, note }: { mode: "real" | "practice"; setMode: (m: "real" | "practice") => void; realLabel: string; note?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div role="tablist" aria-label="Mode" className="inline-flex w-fit rounded-full border border-line-2 bg-card p-1">
        {(["real", "practice"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${mode === m ? "bg-ink text-card" : "text-mute hover:text-ink"}`} data-testid={`mode-${m}`}>
            {m === "real" ? realLabel : "Practice"}
          </button>
        ))}
      </div>
      {note ? <p className="text-[12.5px] text-mute">{note}</p> : null}
    </div>
  );
}
