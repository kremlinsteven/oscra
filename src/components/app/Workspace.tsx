"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useChain } from "@/components/providers/ChainProvider";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN, explorerTx } from "@/config/brand";
import { runbookLive } from "@/config/contracts";
import { storageKey } from "@/config/storage";
import { ERROR_WORDS } from "@/lib/abi";
import { explain, rpcCall, waitForReceipt } from "@/lib/client";
import { RuleError, checkBook, copyBook, freshBook, type Book } from "@/lib/practice";

/*
 * Workspace state shared by every /app screen.
 *   live      the OscraRunbook address is set: screens read the chain and send real transactions.
 *   practice  otherwise: the same screens run src/lib/practice.ts on a book kept in this browser.
 */

export type Notice = { id: number; kind: "ok" | "error" | "info"; text: string; href?: string };

type Ctx = {
  live: boolean;
  book: Book;
  /** Applies a practice action; rule refusals become notices. */
  act: (label: string, fn: (b: Book, now: number) => string | void) => boolean;
  reset: () => void;
  skew: (seconds: number) => void;
  now: () => number;
  price: (lane: number) => number | null;
  notices: Notice[];
  notify: (n: Omit<Notice, "id">) => void;
  dismiss: (id: number) => void;
  /** Sends a real transaction (dry run first), waits for the receipt, then bumps `tick`. */
  send: (label: string, to: string, data: `0x${string}`) => Promise<boolean>;
  busy: string | null;
  tick: number;
  refresh: () => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { address, sendTransaction, onRobinhoodChain, switchNetwork } = useWallet();
  const { facts } = useChain();
  const key = storageKey("practice", (address ?? "guest").toLowerCase());
  const [stored, setStored] = useLocalStore<unknown>(key, null);
  const book = useMemo(() => checkBook(stored) ?? freshBook(), [stored]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [, setClock] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setClock((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const notify = useCallback((n: Omit<Notice, "id">) => setNotices((l) => [{ ...n, id: Date.now() + Math.random() }, ...l].slice(0, 4)), []);
  const dismiss = useCallback((id: number) => setNotices((l) => l.filter((n) => n.id !== id)), []);
  const now = useCallback(() => Math.floor(Date.now() / 1000) + book.skew, [book.skew]);
  const price = useCallback((lane: number) => facts?.prices.find((p) => p.id === lane)?.price ?? null, [facts]);

  const act = useCallback(
    (label: string, fn: (b: Book, now: number) => string | void) => {
      const next = copyBook(book);
      try {
        const msg = fn(next, Math.floor(Date.now() / 1000) + book.skew);
        setStored(next);
        notify({ kind: "ok", text: msg || `${label}: done (practice).` });
        return true;
      } catch (e) {
        const rule = e instanceof RuleError ? e.rule : null;
        notify({ kind: "error", text: rule ? `${label}: ${ERROR_WORDS[rule] ?? rule}` : `${label}: ${(e as Error).message}` });
        return false;
      }
    },
    [book, notify, setStored],
  );

  const reset = useCallback(() => {
    setStored(freshBook());
    notify({ kind: "info", text: "Practice book reset: 10,000 practice USDG, no plans, no follows." });
  }, [notify, setStored]);

  const skew = useCallback(
    (seconds: number) => {
      const next = copyBook(book);
      next.skew += seconds;
      setStored(next);
    },
    [book, setStored],
  );

  const send = useCallback(
    async (label: string, to: string, data: `0x${string}`) => {
      if (!address) {
        notify({ kind: "error", text: "Connect a wallet first." });
        return false;
      }
      setBusy(label);
      try {
        if (!onRobinhoodChain) await switchNetwork();
        // Dry run: a revert is explained before the wallet is asked anything.
        await rpcCall("eth_call", [{ from: address, to, data }, "latest"]);
        const hash = await sendTransaction({ to, data });
        notify({ kind: "info", text: `${label}: sent, waiting for ${CHAIN.name}.`, href: explorerTx(hash) });
        const r = await waitForReceipt(hash);
        notify({ kind: r.ok ? "ok" : "error", text: r.ok ? `${label}: confirmed in block ${r.blockNumber}.` : `${label}: the transaction reverted.`, href: explorerTx(hash) });
        setTick((n) => n + 1);
        return r.ok;
      } catch (e) {
        notify({ kind: "error", text: `${label}: ${explain(e)}` });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [address, notify, onRobinhoodChain, sendTransaction, switchNetwork],
  );

  const value: Ctx = { live: runbookLive(), book, act, reset, skew, now, price, notices, notify, dismiss, send, busy, tick, refresh: () => setTick((n) => n + 1) };
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return c;
}
