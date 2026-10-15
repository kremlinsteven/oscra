"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, Copy, LayoutGrid, LogOut, RefreshCw, TriangleAlert, Wallet, X } from "lucide-react";
import { CHAIN as chain, explorerAddress, shortAddress } from "@/config/brand";
import { WALLETCONNECT_RDNS, useWallet, type DiscoveredWallet } from "@/components/wallet/WalletProvider";
import { WALLET_CATALOG, catalogIcon } from "@/config/wallets";

/* ------------------------------------------------------------------ */
/* One dialog for the whole site. Every "connect" button opens it      */
/* through this context instead of owning a copy of it.                */
/* ------------------------------------------------------------------ */

const ModalContext = createContext<{ open: () => void } | null>(null);

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useCallback(() => setOpen(true), []);
  return (
    <ModalContext.Provider value={{ open: value }}>
      {children}
      {open ? <WalletDialog onClose={() => setOpen(false)} /> : null}
    </ModalContext.Provider>
  );
}

export function useWalletModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useWalletModal must be used inside WalletModalProvider");
  return context;
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function WalletIcon({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" width={28} height={28} className="size-[28px] rounded-[8px]" />
  ) : (
    <span className="grid size-[28px] place-items-center rounded-[8px] border border-line-2">
      <Wallet size={14} className="text-mute" />
    </span>
  );
}

const ROW = "flex w-full items-center gap-3 border-b border-line px-1 py-3 text-left text-[14.5px] transition-colors last:border-b-0 enabled:hover:bg-card-2 disabled:cursor-not-allowed";

function Group({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="label flex items-baseline gap-3 border-b border-line-2 pb-2">
        <span className="text-olive">{n}</span>
        <span>{label}</span>
      </p>
      <div>{children}</div>
    </section>
  );
}

function WalletDialog({ onClose }: { onClose: () => void }) {
  const { wallets, connect, connecting, error, clearError } = useWallet();
  const [pending, setPending] = useState<string | null>(null);

  const close = useCallback(() => {
    onClose();
    clearError();
  }, [onClose, clearError]);

  useEffect(() => {
    // Late-loading extensions announce on request, so ask again on open.
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const installed = wallets.filter((w) => w.rdns !== WALLETCONNECT_RDNS).sort((a, b) => Number(Boolean(a.unsupported)) - Number(Boolean(b.unsupported)));
  const walletConnect = wallets.find((w) => w.rdns === WALLETCONNECT_RDNS) ?? null;
  const detected = new Set(wallets.map((w) => w.rdns));
  const more = WALLET_CATALOG.filter((c) => !c.rdns.some((r) => detected.has(r)));
  const mobile = isMobile();
  const here = window.location.href;

  async function pick(wallet: DiscoveredWallet) {
    setPending(wallet.rdns);
    const ok = await connect(wallet);
    setPending(null);
    if (ok) onClose();
  }

  // The dialog always goes to <body>, so no header style can ever clip it.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-dialog-title"
        className="flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[24px] border border-line bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]"
        data-testid="wallet-dialog"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p className="label">Workspace access</p>
            <h2 id="wallet-dialog-title" className="mt-1 text-[26px] font-medium leading-tight tracking-[-0.03em]">
              Connect a wallet
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-mute">Connecting shares your address and nothing else. Every plan, follow or stake asks your wallet before anything moves.</p>
          </div>
          <button type="button" aria-label="Close" onClick={close} className="grid size-8 shrink-0 place-items-center rounded-full border border-line-2 text-mute hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {installed.length ? (
            <Group n="01" label="Detected in this browser">
              {installed.map((wallet) => (
                <button
                  key={wallet.rdns}
                  type="button"
                  disabled={connecting || Boolean(wallet.unsupported)}
                  onClick={() => pick(wallet)}
                  className={`${ROW} ${wallet.unsupported ? "opacity-50" : ""}`}
                  data-testid={`wallet-${wallet.rdns}`}
                >
                  <WalletIcon src={wallet.icon || catalogIcon(wallet.rdns)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{wallet.name}</span>
                    <span className="block text-[12px] text-mute">{wallet.unsupported ? `Not supported · ${wallet.unsupported}` : "Ready"}</span>
                  </span>
                  {pending === wallet.rdns ? <span className="chip chip-light-clear">Check wallet</span> : null}
                </button>
              ))}
            </Group>
          ) : null}

          <Group n={installed.length ? "02" : "01"} label="Phone wallets">
            {walletConnect ? (
              <button type="button" disabled={connecting} onClick={() => pick(walletConnect)} className={ROW} data-testid="wallet-walletconnect">
                <WalletIcon src="/wallets/walletconnect.webp" />
                <span className="min-w-0 flex-1">
                  WalletConnect
                  <span className="block text-[12px] text-mute">Scan a QR code with your phone</span>
                </span>
                {pending === WALLETCONNECT_RDNS ? <span className="chip chip-light-clear">Opening</span> : null}
              </button>
            ) : (
              <div className={`${ROW} opacity-55`} data-testid="wallet-walletconnect">
                <WalletIcon src="/wallets/walletconnect.webp" />
                <span className="min-w-0 flex-1">
                  WalletConnect
                  <span className="block text-[12px] text-mute">Not configured on this site yet</span>
                </span>
              </div>
            )}
          </Group>

          {more.length ? (
            <Group n={installed.length ? "03" : "02"} label={mobile ? "Open this site inside a wallet app" : `Get a wallet that reaches ${chain.name}`}>
              {more.map((w) => {
                const href = mobile && w.deepLink ? w.deepLink(here) : w.install;
                const label = mobile && w.deepLink ? "Open" : "Install";
                return (
                  <a key={w.id} href={href} target="_blank" rel="noreferrer" className={`${ROW} hover:bg-card-2`}>
                    <WalletIcon src={`/wallets/${w.id}.webp`} />
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    <span className="link-arrow inline-flex items-center gap-1 text-olive">
                      {label} <ArrowUpRight size={13} />
                    </span>
                  </a>
                );
              })}
            </Group>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="mx-5 mb-3 flex gap-2 rounded-[12px] border border-bad/30 bg-[#fbe1dc] px-3 py-2.5 text-[13px] text-bad">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <p className="flex items-center gap-2 border-t border-line bg-card-2 px-5 py-3 font-mono text-[11px] text-mute">
          <span className="size-1.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
          <span>
            {chain.name} · chain id {chain.id} · added to your wallet on connect
          </span>
        </p>
      </div>
    </div>,
    document.body,
  );
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
  const { address, walletName, chainId, balance, onRobinhoodChain, switchNetwork, switching, disconnect, error } = useWallet();
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
  const wrongNetwork = chainId !== null && !onRobinhoodChain;

  return (
    <div ref={root} className="flex min-w-0 items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-[32px] items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 font-mono text-[11.5px] text-night-ink hover:border-lime"
        title={wrongNetwork ? `Wallet is on chain ${chainId}, not ${chain.name}` : `Connected on ${chain.name}`}
        data-testid="account-chip"
      >
        <span className={`size-2 shrink-0 rounded-full ${wrongNetwork ? "bg-bad" : "bg-lime"}`} data-testid="account-dot" aria-hidden="true" />
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
                  <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${wrongNetwork ? "text-bad" : "text-olive"}`} data-testid="account-network">
                    <span className={`size-1.5 rounded-full ${wrongNetwork ? "bg-bad" : "bg-lime"}`} />
                    {chainId === null ? "Reading network" : onRobinhoodChain ? chain.name : `Chain ${chainId}`}
                  </span>
                </div>
                <span className="mt-1 block font-mono text-[12.5px] text-mute">{shortAddress(address, 10, 8)}</span>
                <span className="label mt-3 block">Native balance</span>
                <span className="num block text-[20px]" data-testid="account-balance">
                  {balance === null ? "…" : `${balance} ${chain.nativeSymbol}`}
                </span>
                {wrongNetwork ? (
                  <button type="button" role="menuitem" disabled={switching} onClick={switchNetwork} className="btn btn-lime mt-3 w-full" data-testid="account-switch">
                    <RefreshCw size={13} /> {switching ? "Confirm in wallet…" : `Switch to ${chain.name}`}
                  </button>
                ) : null}
                {wrongNetwork && error ? <p className="mt-2 text-[12px] text-bad">{error}</p> : null}
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
