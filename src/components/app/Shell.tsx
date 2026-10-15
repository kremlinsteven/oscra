"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, FlaskConical, Radio, X } from "lucide-react";
import { useWorkspace } from "@/components/app/Workspace";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { span } from "@/lib/format";

const TABS = [
  { href: "/app", label: "Overview" },
  { href: "/app/dca", label: "Recurring buys" },
  { href: "/app/copy", label: "Copy desks" },
  { href: "/app/review", label: "Trade review" },
  { href: "/app/stake", label: "Stake & vote" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { book, skew, reset, notices, dismiss } = useWorkspace();
  const { address } = useWallet();
  const { open } = useWalletModal();
  return (
    <main className="shell pt-8 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="tag">Workspace</span>
          <h1 className="mt-3 text-[30px] font-medium tracking-[-0.03em]">Your trading desk</h1>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[16px] border border-line-2 bg-card px-3 py-2 text-[12.5px]" data-testid="mode-banner">
          <Radio size={14} className="text-olive" />
          <span className="font-semibold">Real orders go through your wallet on Solana</span>
          <span className="text-mute">·</span>
          <FlaskConical size={14} className="text-warn" />
          <span className="text-mute">practice book</span>
          {book.skew ? <span className="num text-mute">clock +{span(book.skew)}</span> : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => skew(3600)}>
            +1 h
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => skew(86_400)}>
            +1 day
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
      <nav aria-label="Workspace" className="scroll-x mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium whitespace-nowrap ${path === t.href ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {!address ? (
        <div className="mt-6 flex flex-col gap-3 rounded-[18px] border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-ink-2">You can practice without a wallet. Connect one to place real Jupiter orders, follow desks, vote, and keep a separate practice book per address.</p>
          <button type="button" onClick={open} className="btn btn-ink shrink-0">
            Connect wallet
          </button>
        </div>
      ) : null}
      <div className="mt-8">{children}</div>
      <div className="pointer-events-none fixed right-3 bottom-3 z-[60] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} role="status" className={`pointer-events-auto flex items-start gap-2 rounded-[14px] border px-3 py-2.5 text-[13px] shadow-lg ${n.kind === "error" ? "border-bad/30 bg-[#fbe1dc] text-bad" : n.kind === "ok" ? "border-lime/60 bg-lime-soft text-ink" : "border-line bg-card text-ink"}`}>
            <span className="min-w-0 flex-1">
              {n.text}
              {n.href ? (
                <a href={n.href} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-semibold underline">
                  tx <ExternalLink size={11} />
                </a>
              ) : null}
            </span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(n.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
