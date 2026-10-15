"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { NavWallet } from "@/components/wallet/WalletButton";
import { ContractTag } from "@/components/site/ContractTag";
import { Wordmark } from "@/components/site/Mark";
import { NAV } from "@/components/site/nav";

/** Floating dark bar: brand on the left, the six product pages, then the token address and the wallet. */
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="mx-auto flex h-[54px] max-w-[1180px] items-center gap-3 rounded-full bg-night pr-2 pl-4 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.6)]">
        <Link href="/" className="shrink-0" aria-label="OSCRA home">
          <Wordmark dark />
        </Link>
        <nav aria-label="Main" className="mx-auto hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-3 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition-colors ${path === n.href ? "bg-white/10 text-night-ink" : "text-night-mute hover:text-night-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-1.5 lg:ml-0">
          <ContractTag shape="bar" />
          <Link href="/app" className="hidden rounded-full px-3 py-1.5 text-[13px] font-medium text-night-mute hover:text-night-ink xl:inline-flex">
            Workspace
          </Link>
          <NavWallet />
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full text-night-ink hover:bg-white/10 lg:hidden" data-testid="menu-open">
            <Menu size={18} />
          </button>
        </div>
      </div>
      {open ? <MobileMenu onClose={() => setOpen(false)} /> : null}
    </header>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/50 lg:hidden" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-x-3 top-3 rounded-[24px] bg-night p-5 text-night-ink" role="dialog" aria-label="Menu">
        <div className="flex items-center justify-between">
          <Wordmark dark />
          <button type="button" aria-label="Close menu" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <nav className="mt-5 grid gap-1">
          {[...NAV, { href: "/app", label: "Open the workspace" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={onClose} className="rounded-[12px] px-3 py-2.5 text-[16px] font-medium hover:bg-white/8">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  );
}
