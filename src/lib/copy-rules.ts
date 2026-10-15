/*
 * The follower's limits for a REAL copied trade, checked in the app before any swap is built. The swap itself is a
 * plain Jupiter swap the follower signs; these rules decide whether the button is offered and how much it spends.
 * Holdings and daily spend come from the follower's own recorded fills (each one verified on-chain by the server).
 */
import { LANES, LIMITS } from "@/config/lanes";
import type { Fill, FollowRecord, Idea } from "@/lib/records-shared";

const BPS = 10_000;
const DAY = 86_400;

export type CopyPlan = { ok: true; side: "buy"; usdc: number } | { ok: true; side: "sell"; qty: number } | { ok: false; reason: string; stop?: boolean };

/** What this desk's copies left on one market: quantity and the USDC that went in. */
export function holdingOf(fills: Fill[], ideas: Idea[], leader: string, lane: number) {
  const byId = new Map(ideas.map((i) => [i.id, i]));
  let qty = 0;
  let cost = 0;
  for (const f of [...fills].sort((a, b) => a.at - b.at)) {
    const idea = byId.get(f.signal);
    if (!idea || idea.leader !== leader || f.lane !== lane) continue;
    if (f.sell) {
      const share = qty > 0 ? Math.min(1, f.qty / qty) : 1;
      cost -= cost * share;
      qty = Math.max(0, qty - f.qty);
    } else {
      qty += f.qty;
      cost += f.usdc;
    }
  }
  return { qty, cost };
}

export function spentToday(fills: Fill[], ideas: Idea[], leader: string, now: number) {
  const byId = new Map(ideas.map((i) => [i.id, i]));
  return fills.filter((f) => !f.sell && now - f.at < DAY && byId.get(f.signal)?.leader === leader).reduce((a, f) => a + f.usdc, 0);
}

export function copyWindow(idea: Idea, f: FollowRecord) {
  const opens = idea.at + f.reviewDelay;
  return [opens, opens + LIMITS.mirrorWindowH * 3600] as const;
}

export function planCopy(o: { idea: Idea; follow: FollowRecord | undefined; handled: string | undefined; fills: Fill[]; ideas: Idea[]; price: number | null; walletQty: number | null; now: number }): CopyPlan {
  const { idea, follow: f, now, price } = o;
  if (!f) return { ok: false, reason: "You do not follow this desk." };
  if (idea.at < f.since) return { ok: false, reason: "Posted before you followed." };
  if ((f.laneMask & (1 << idea.lane)) === 0) return { ok: false, reason: `${LANES[idea.lane].symbol} is not in your copied markets.` };
  if (o.handled) return { ok: false, reason: o.handled === "skipped" ? "Skipped." : "Already copied." };
  const [opens, closes] = copyWindow(idea, f);
  if (now < opens) return { ok: false, reason: "Still in your review delay." };
  if (now > closes) return { ok: false, reason: "The copy window has closed." };
  if (!(price && price > 0)) return { ok: false, reason: "No live price right now." };
  const h = holdingOf(o.fills, o.ideas, idea.leader, idea.lane);
  if (idea.sell) {
    if (price * BPS < idea.price * (BPS - f.chaseBps)) return { ok: false, reason: "Price fell past your chase limit." };
    const qty = Math.min((h.qty * idea.weightBps) / BPS, o.walletQty ?? 0);
    if (!(qty > 0)) return { ok: false, reason: "Nothing copied from this desk to sell." };
    return { ok: true, side: "sell", qty };
  }
  if (price * BPS > idea.price * (BPS + f.chaseBps)) return { ok: false, reason: "Price ran past your chase limit." };
  if (f.stopBps !== 0 && h.qty > 0 && h.qty * price * BPS < h.cost * (BPS - f.stopBps)) return { ok: false, reason: "Your stop is hit: the copied position is down past your limit. Unfollow or raise the stop.", stop: true };
  const usdc = (f.perSignal * idea.weightBps) / BPS;
  if (usdc < LIMITS.minSpend) return { ok: false, reason: "Amount below 1 USDC." };
  if (spentToday(o.fills, o.ideas, idea.leader, now) + usdc > f.dayCap) return { ok: false, reason: "Daily cap for this desk reached." };
  if (f.maxCost !== 0 && h.cost + usdc > f.maxCost) return { ok: false, reason: "Position cap for this desk reached." };
  return { ok: true, side: "buy", usdc };
}
