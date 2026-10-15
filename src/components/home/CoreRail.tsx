import { BookOpenCheck, CalendarClock, Gauge, ShieldHalf, Users, Wallet } from "lucide-react";
import { Mark } from "@/components/site/Mark";

const LEFT = [
  { icon: BookOpenCheck, k: "Review", v: "Five checks before you act" },
  { icon: CalendarClock, k: "Plans", v: "Recurring buys on a pace" },
  { icon: Users, k: "Follows", v: "Copied ideas inside caps" },
];
const RIGHT = [
  { icon: Gauge, k: "Prices", v: "Pyth or Jupiter, by mint" },
  { icon: ShieldHalf, k: "Limits", v: "Ceilings, guards, caps, delays" },
  { icon: Wallet, k: "Wallet", v: "Assets land in your address" },
];

/** Inputs on the left, checks on the right, your wallet in the middle. */
export function CoreRail() {
  const Item = ({ icon: Icon, k, v }: (typeof LEFT)[number]) => (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card-2 text-ink">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{k}</span>
        <span className="block text-[12.5px] text-mute">{v}</span>
      </span>
    </div>
  );
  return (
    <div className="grid-paper grid grid-cols-1 items-center gap-6 rounded-[28px] border border-line p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
      <div className="grid gap-3">
        {LEFT.map((x) => (
          <Item key={x.k} {...x} />
        ))}
      </div>
      <div className="panel flex flex-col items-center px-6 py-8 text-center">
        <Mark size={72} />
        <p className="mt-4 text-[16px] font-semibold tracking-[0.06em]">YOUR SIGNATURE</p>
        <p className="mt-2 text-[12.5px] text-night-mute">Check your limits · build the Jupiter order · you sign · it lands in your wallet. No balance kept.</p>
      </div>
      <div className="grid gap-3">
        {RIGHT.map((x) => (
          <Item key={x.k} {...x} />
        ))}
      </div>
    </div>
  );
}
