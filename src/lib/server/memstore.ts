import type { Store } from "@/lib/server/store";

/*
 * In-process stand-in for the KV store when KV_REST_API_URL / KV_REST_API_TOKEN are not set (a local run, or a
 * deployment the owner has not wired yet). Bounded on purpose:
 *   - a hard key cap (MEM_KEYS); when full, expired keys are swept and a NEW key is refused (no eviction of live
 *     keys, so a flood of fresh entries can never push out real records),
 *   - every key expires: values written without a TTL get MEM_MAX_TTL (one day), longer TTLs are clamped to it,
 *   - lists are capped by their own `keep` and every value by MEM_MAX_VALUE characters.
 * Nothing here survives a restart, and the site says so ("records not configured").
 */

export const MEM_KEYS = 5_000;
export const MEM_MAX_TTL = 86_400;
export const MEM_MAX_VALUE = 64_000;

type Entry = { v: string | string[]; until: number };

export function memoryStore(now: () => number = () => Date.now()): Store & { size: () => number } {
  const map = new Map<string, Entry>();
  const ttlMs = (ttl?: number) => Math.min(Math.max(1, ttl ?? MEM_MAX_TTL), MEM_MAX_TTL) * 1000;
  const live = (key: string) => {
    const e = map.get(key);
    if (!e) return null;
    if (e.until <= now()) {
      map.delete(key);
      return null;
    }
    return e;
  };
  const makeRoom = () => {
    if (map.size < MEM_KEYS) return;
    let i = 0;
    for (const [k, e] of map) {
      if (i++ > 256) break;
      if (e.until <= now()) map.delete(k);
    }
    if (map.size >= MEM_KEYS) {
      for (const [k, e] of map) if (e.until <= now()) map.delete(k);
    }
    if (map.size >= MEM_KEYS) throw new Error("Record store is full.");
  };
  const put = (key: string, v: string | string[], ttl?: number, keepUntil?: number) => {
    if (typeof v === "string" && v.length > MEM_MAX_VALUE) throw new Error("Value too large.");
    if (!map.has(key)) makeRoom();
    else map.delete(key); // re-insert so insertion order tracks the latest write
    map.set(key, { v, until: keepUntil ?? now() + ttlMs(ttl) });
  };
  const str = (key: string) => {
    const e = live(key);
    return e && typeof e.v === "string" ? e.v : null;
  };
  const add = (key: string, by: number, ttl?: number) => {
    const e = live(key);
    const n = (e && typeof e.v === "string" ? Number(e.v) || 0 : 0) + Math.trunc(by);
    put(key, String(n), ttl, e ? e.until : undefined);
    return n;
  };
  return {
    size: () => map.size,
    get: async (key) => str(key),
    setEx: async (key, value, ttl) => put(key, value, ttl),
    setNx: async (key, value, ttl) => {
      if (live(key)) return false;
      put(key, value, ttl);
      return true;
    },
    del: async (key) => void map.delete(key),
    take: async (key) => {
      const v = str(key);
      map.delete(key);
      return v;
    },
    delIf: async (key, value) => {
      if (str(key) !== value) return false;
      map.delete(key);
      return true;
    },
    incr: async (key) => add(key, 1),
    incrBy: async (key, by) => add(key, by),
    incrEx: async (key, ttl) => add(key, 1, ttl),
    incrByEx: async (key, by, ttl) => add(key, by, ttl),
    mget: async (keys) => keys.map(str),
    set: async (key, value) => put(key, value),
    pushCapped: async (key, value, keep) => {
      if (value.length > MEM_MAX_VALUE) throw new Error("Value too large.");
      const e = live(key);
      const list = e && Array.isArray(e.v) ? [value, ...e.v].slice(0, keep) : [value];
      put(key, list);
    },
    range: async (key, count) => {
      const e = live(key);
      return e && Array.isArray(e.v) ? e.v.slice(0, count) : [];
    },
  };
}
