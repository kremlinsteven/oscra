import { NextResponse } from "next/server";
import { LANES } from "@/config/lanes";
import { buildReview, type Review } from "@/lib/review";
import { budget } from "@/lib/guard";
import { readSeries } from "@/lib/server/series";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/*
 * The rule-based review for one lane (?lane=0..9). Cached five minutes per lane and refreshed by one request at
 * a time, at most once a minute while upstream reads keep failing, so visitors never multiply upstream calls.
 */

const TTL = 300_000;
const RETRY = 60_000;
const cache = new Map<number, { at: number; value: Review }>();
const inflight = new Map<number, Promise<void>>();
const lastTry = new Map<number, number>();

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("lane") ?? "0";
  const lane = /^\d{1,2}$/.test(raw) ? Number(raw) : -1;
  if (!LANES.some((l) => l.id === lane)) return NextResponse.json({ error: "Unknown lane." }, { status: 400 });
  if (!(await budget(getStore(), request, "review", 1, 120, 6_000, 600))) return NextResponse.json({ error: "Too many requests. Slow down a little." }, { status: 429 });
  const hit = cache.get(lane);
  if ((!hit || Date.now() - hit.at > TTL) && Date.now() - (lastTry.get(lane) ?? 0) > RETRY && !inflight.has(lane)) {
    lastTry.set(lane, Date.now());
    inflight.set(
      lane,
      readSeries(lane)
        .then((s) => {
          const review = s ? buildReview(lane, s.source, s.points, s.unit) : null;
          if (review) cache.set(lane, { at: Date.now(), value: review });
        })
        .catch(() => {})
        .finally(() => inflight.delete(lane)),
    );
  }
  const pending = inflight.get(lane);
  if (pending) await pending;
  const value = cache.get(lane);
  if (!value) return NextResponse.json({ error: "Price history is not available right now." }, { status: 503, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ ...value.value, cachedAt: value.at }, { headers: { "cache-control": "no-store" } });
}
