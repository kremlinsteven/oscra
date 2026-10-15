"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider as AdapterWalletProvider, useConnection, useWallet as useAdapterWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider as AdapterModalProvider } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { CHAIN } from "@/config/brand";
import "@solana/wallet-adapter-react-ui/styles.css";

/*
 * Solana wallets through the standard wallet adapter. `wallets: []` means every Wallet Standard wallet the
 * browser has (Phantom, Solflare, Backpack and others) is detected on its own; nothing is bundled per brand.
 * The connection points at the public RPC (or NEXT_PUBLIC_SOLANA_RPC_URL) and wallets send their own
 * transactions. The site never sees a key.
 */

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = CHAIN.rpc;
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <AdapterWalletProvider wallets={wallets} autoConnect>
        <AdapterModalProvider className="oscra-wallet-modal">{children}</AdapterModalProvider>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}

/** The wallet as the site uses it: address, name, SOL balance, sign and send. */
export function useWallet() {
  const a = useAdapterWallet();
  const { connection } = useConnection();
  const address = a.publicKey?.toBase58() ?? null;
  const [balance, setBalance] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!a.publicKey) return;
    let gone = false;
    fetch("/api/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [a.publicKey.toBase58()] }) })
      .then((r) => r.json())
      .then((b: { result?: { value: number } }) => {
        if (!gone && typeof b.result?.value === "number") setBalance((b.result.value / 1e9).toFixed(4));
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [a.publicKey, tick]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!a.signMessage) throw new Error("This wallet cannot sign messages.");
      const sig = await a.signMessage(new TextEncoder().encode(message));
      return bs58.encode(sig);
    },
    [a],
  );

  /** Signs with the wallet and returns the base64 signed transaction (for APIs that land it themselves). */
  const signTransaction = useCallback(
    async (tx: VersionedTransaction) => {
      if (!a.signTransaction) throw new Error("This wallet cannot sign transactions.");
      const signed = await a.signTransaction(tx);
      return signed;
    },
    [a],
  );

  /** The wallet signs and sends; returns the signature. */
  const sendTransaction = useCallback(async (tx: VersionedTransaction) => a.sendTransaction(tx, connection, { maxRetries: 3 }), [a, connection]);

  return {
    address,
    walletName: a.wallet?.adapter.name ?? null,
    walletIcon: a.wallet?.adapter.icon ?? null,
    connecting: a.connecting,
    balance: address ? balance : null,
    refreshBalance: () => setTick((n) => n + 1),
    signMessage,
    signTransaction,
    sendTransaction,
    disconnect: () => void a.disconnect(),
  };
}
