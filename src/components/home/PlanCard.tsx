import { Pause, ShieldCheck, Target } from "lucide-react";

/** An example plan, drawn as the workspace shows it. Settings only: no invented fills or returns. */
export function PlanCard() {
  const schedule = ["Mon 09:00", "Wed 09:00", "Fri 09:00", "Sun 09:00", "Tue 09:00", "Thu 09:00"];
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Plan · NVDA</p>
          <p className="text-[12px] text-night-mute">USDG → NVIDIA stock token · Uniswap 0.05% pool</p>
        </div>
        <span className="chip chip-clear">Example</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-px bg-night-line sm:grid-cols-4">
        {[
          ["Order", "$250"],
          ["Every", "48 hours"],
          ["Budget", "$3,000"],
          ["Slippage", "1.5%"],
        ].map(([k, v]) => (
          <div key={k} className="bg-night px-4 py-3">
            <p className="label">{k}</p>
            <p className="num mt-1 text-[16px]">{v}</p>
          </div>
        ))}
      </div>
      <ul>
        {[
          [ShieldCheck, "Price ceiling", "Skip any buy while NVDA is above $260"],
          [Pause, "Drawdown guard", "Pause if price falls 15% under my average"],
          [Target, "Target pause", "Pause once price is 25% over my average"],
        ].map(([Icon, k, v]) => {
          const I = Icon as typeof Pause;
          return (
            <li key={k as string} className="panel-row flex items-center gap-3 px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/6 text-lime">
                <I size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{k as string}</span>
                <span className="block text-[12px] text-night-mute">{v as string}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="panel-row px-5 py-4">
        <p className="label">Next six buy windows</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {schedule.map((s, i) => (
            <div key={s} className={`rounded-[10px] px-2 py-2 text-center ${i === 0 ? "bg-lime text-ink" : "bg-white/5 text-night-mute"}`}>
              <p className="num text-[11px]">{s}</p>
              <p className="mt-0.5 text-[10.5px]">{i === 0 ? "next" : "$250"}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-night-mute">Twelve orders spend the budget; the plan then stops by itself.</p>
      </div>
    </div>
  );
}
