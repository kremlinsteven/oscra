"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useWalletModal as useAdapterModal } from "@solana/wallet-adapter-react-ui";
import { ArrowUpRight, Check, Copy, LayoutGrid, LogOut } from "lucide-react";
import { CHAIN as chain, explorerAddress, shortAddress } from "@/config/brand";
import { useWallet } from "@/components/wallet/WalletProvider";

/*
 * One wallet dialog for the whole site: the standard Solana wallet-adapter modal (restyled in globals.css under
 * .oscra-wallet-modal). It lists every wallet the browser has, or offers install links when none is found.
 * Every "connect" button opens the same dialog through useWalletModal().
 */

/** Kept for the layout tree; the adapter's modal provider lives in WalletProvider. */
export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useWalletModal() {
  const { setVisible } = useAdapterModal();
  return { open: () => setVisible(true) };
}

/* ------------------------------------------------------------------ */
/* Navbar control                                                      */
/* ------------------------------------------------------------------ */

export function NavWallet({ label = "Connect", className = "btn btn-lime btn-sm" }: { label?: string; className?: string }) {
  const { address } = useWallet();
  const { open } = useWalletModal();
  if (address) return <AccountMenu />;
  return (
    <button type="button" onClick={open} className={className} data-testid="nav-connect">
      {label}
    </button>
  );
}

const MI = "flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-left text-[13.5px] text-mute hover:bg-card-2 hover:text-ink [&>svg]:size-4 [&>svg]:text-faint";

function AccountMenu() {
  const { address, walletName, walletIcon, balance, refreshBalance, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const WIDTH = 280;
    const position = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 8));
      const below = rect.bottom + 8;
      // Near the bottom of the screen (the app sidebar) the menu opens upwards.
      const top = below + 380 > window.innerHeight && rect.top > 400 ? rect.top - 8 - 372 : below;
      setPlace({ top, left });
    };
    position();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);

  if (!address) return null;

  return (
    <div ref={root} className="flex min-w-0 items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) refreshBalance();
          setOpen((value) => !value);
        }}
        className="inline-flex h-[32px] items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 font-mono text-[11.5px] text-night-ink hover:border-lime"
        title={`Connected on ${chain.name}`}
        data-testid="account-chip"
      >
        {walletIcon ? <img src={walletIcon} alt="" width={14} height={14} className="size-[14px] rounded-[4px]" /> : <span className="size-2 shrink-0 rounded-full bg-lime" data-testid="account-dot" aria-hidden="true" />}
        <span className="whitespace-nowrap">{shortAddress(address, 5, 4)}</span>
      </button>

      {open && place
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              style={{ position: "fixed", top: place.top, left: place.left, width: 280, zIndex: 80 }}
              className="overflow-hidden rounded-[24px] border border-line bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]"
              data-testid="account-menu"
            >
              <div className="px-3 pt-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="label">{walletName ?? "Wallet"}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-olive" data-testid="account-network">
                    <span className="size-1.5 rounded-full bg-lime" />
                    {chain.name} mainnet
                  </span>
                </div>
                <span className="mt-1 block font-mono text-[12.5px] text-mute">{shortAddress(address, 10, 8)}</span>
                <span className="label mt-3 block">SOL balance</span>
                <span className="num block text-[20px]" data-testid="account-balance">
                  {balance === null ? "…" : `${balance} ${chain.nativeSymbol}`}
                </span>
              </div>
              <div>
                <Link role="menuitem" href="/app" onClick={() => setOpen(false)} className={MI}>
                  <LayoutGrid /> Open the workspace
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className={MI}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      // Clipboard refused; the address above stays readable.
                    }
                  }}
                >
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy address"}
                </button>
                <a role="menuitem" href={explorerAddress(address)} target="_blank" rel="noreferrer" className={MI}>
                  <ArrowUpRight /> View on explorer
                </a>
                <button
                  type="button"
                  role="menuitem"
                  className={`${MI} text-bad hover:text-bad [&>svg]:text-bad`}
                  onClick={() => {
                    setOpen(false);
                    disconnect();
                  }}
                  data-testid="account-disconnect"
                >
                  <LogOut /> Disconnect
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
