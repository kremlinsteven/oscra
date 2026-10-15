"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { VersionedTransaction } from "@solana/web3.js";
import { useChain } from "@/components/providers/ChainProvider";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explorerTx } from "@/config/brand";
import { storageKey } from "@/config/storage";
import { explain, readWallet, waitForSignature, type Wallet } from "@/lib/client";
import { RULE_WORDS, RuleError, checkBook, copyBook, freshBook, type Book } from "@/lib/practice";
import { fetchBoard, signRecord } from "@/lib/records-client";
import type { Action, Board } from "@/lib/records-shared";

/*
 * Workspace state shared by every /app screen.
 *   real      wallet transactions through Jupiter (Recurring orders, swaps) and wallet-signed records
 *             (desk ideas, follows, polls) on the OSCRA server. Needs a connected wallet.
 *   practice  the same rules on a simulated book kept in this browser (src/lib/practice.ts), live prices.
 */

export type Notice = { id: number; kind: "ok" | "error" | "info"; text: string; href?: string };

type Ctx = {
  book: Book;
  act: (label: string, fn: (b: Book, now: number) => string | void) => boolean;
  reset: () => void;
  skew: (seconds: number) => void;
  now: () => number;
  /** The real clock (no practice skew), for real orders and records. */
  wallClock: () => number;
  price: (lane: number) => number | null;
  notices: Notice[];
  notify: (n: Omit<Notice, "id">) => void;
  dismiss: (id: number) => void;
  /** Builds a transaction, has the wallet sign and send it, waits for confirmation. Returns the signature. */
  sendTx: (label: string, build: () => Promise<VersionedTransaction>) => Promise<string | null>;
  /** Signs one record with the wallet and posts it. */
  record: (label: string, action: Action, payload: unknown) => Promise<boolean>;
  wallet: Wallet | null;
  board: Board | null;
  busy: string | null;
  tick: number;
  refresh: () => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { address, sendTransaction, signMessage, refreshBalance } = useWallet();
  const { facts } = useChain();
  const key = storageKey("practice", address ?? "guest");
  const [stored, setStored] = useLocalStore<unknown>(key, null);
  const book = useMemo(() => checkBook(stored) ?? freshBook(), [stored]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [, setClock] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setClock((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let off = false;
    if (address) readWallet(address).then((w) => !off && setWallet(w)).catch(() => {});
    fetchBoard(address).then((b) => !off && setBoard(b)).catch(() => {});
    return () => {
      off = true;
    };
  }, [address, tick]);

  const notify = useCallback((n: Omit<Notice, "id">) => setNotices((l) => [{ ...n, id: Date.now() + Math.random() }, ...l].slice(0, 4)), []);
  const dismiss = useCallback((id: number) => setNotices((l) => l.filter((n) => n.id !== id)), []);
  const now = useCallback(() => Math.floor(Date.now() / 1000) + book.skew, [book.skew]);
  const wallClock = useCallback(() => Math.floor(Date.now() / 1000), []);
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
        notify({ kind: "error", text: rule ? `${label}: ${RULE_WORDS[rule] ?? rule}` : `${label}: ${(e as Error).message}` });
        return false;
      }
    },
    [book, notify, setStored],
  );

  const reset = useCallback(() => {
    setStored(freshBook());
    notify({ kind: "info", text: "Practice book reset: 10,000 practice USDC, no plans, no follows." });
  }, [notify, setStored]);

  const skew = useCallback(
    (seconds: number) => {
      const next = copyBook(book);
      next.skew += seconds;
      setStored(next);
    },
    [book, setStored],
  );

  const sendTx = useCallback(
    async (label: string, build: () => Promise<VersionedTransaction>) => {
      if (!address) {
        notify({ kind: "error", text: "Connect a wallet first." });
        return null;
      }
      setBusy(label);
      try {
        const tx = await build();
        const sig = await sendTransaction(tx);
        notify({ kind: "info", text: `${label}: sent, waiting for Solana.`, href: explorerTx(sig) });
        const r = await waitForSignature(sig);
        notify({ kind: r.ok ? "ok" : "error", text: r.ok ? `${label}: confirmed.` : `${label}: ${r.error ?? "failed"}.`, href: explorerTx(sig) });
        setTick((n) => n + 1);
        refreshBalance();
        return r.ok ? sig : null;
      } catch (e) {
        notify({ kind: "error", text: `${label}: ${explain(e)}` });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [address, notify, refreshBalance, sendTransaction],
  );

  const record = useCallback(
    async (label: string, action: Action, payload: unknown) => {
      if (!address) {
        notify({ kind: "error", text: "Connect a wallet first." });
        return false;
      }
      setBusy(label);
      try {
        const msg = await signRecord(address, signMessage, action, payload);
        notify({ kind: "ok", text: `${label}: ${msg}` });
        setTick((n) => n + 1);
        return true;
      } catch (e) {
        notify({ kind: "error", text: `${label}: ${explain(e)}` });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [address, notify, signMessage],
  );

  const value: Ctx = { book, act, reset, skew, now, wallClock, price, notices, notify, dismiss, sendTx, record, wallet, board, busy, tick, refresh: () => setTick((n) => n + 1) };
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return c;
}

/** Per-screen choice between real (wallet) and practice, remembered in this browser. */
export function useMode(screen: string) {
  const [mode, setMode] = useLocalStore<"real" | "practice">(storageKey("mode", screen), "real");
  return [mode === "practice" ? "practice" : "real", setMode] as const;
}
