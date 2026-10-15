import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ContractTag } from "@/components/site/ContractTag";
import { Wordmark } from "@/components/site/Mark";
import { FOOTER } from "@/components/site/nav";

const TOPICS = ["Recurring buys", "Trade review", "Copy desks", "Your limits", "Wallet custody", "Live chain data"];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-card-2">
      <div className="overflow-hidden border-b border-line py-3" aria-hidden="true">
        <div className="marquee">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {[...TOPICS, ...TOPICS].map((t, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-6 px-6 font-mono text-[11px] tracking-[0.12em] text-mute uppercase">
                  {t}
                  <span className="size-1.5 rounded-full bg-lime" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="shell grid grid-cols-1 gap-10 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <Wordmark />
          <p className="mt-5 max-w-[30ch] text-[26px] leading-[1.15] font-medium tracking-[-0.03em]">
            <span className="text-faint">Write the limits first.</span> Let the schedule keep them.
          </p>
          <p className="mt-4 max-w-[46ch] text-[14px] text-mute">{BRAND.tagline}</p>
          <div className="mt-6 max-w-[480px]">
            <ContractTag shape="slab" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {Object.entries(FOOTER).map(([title, links]) => (
            <div key={title}>
              <p className="label">{title}</p>
              <ul className="mt-3 space-y-2">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13.5px] text-ink-2 hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="shell flex flex-col gap-3 border-t border-line py-6 text-[12.5px] text-mute sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 {BRAND.name}. Software for your own wallet; nothing here is investment advice.</span>
        <span className="flex items-center gap-4">
          <a href={BRAND.x} target="_blank" rel="noreferrer" className="font-medium text-ink-2 hover:text-ink">
            X {BRAND.xHandle}
          </a>
          <span>{BRAND.chainName}</span>
        </span>
      </div>
    </footer>
  );
}
