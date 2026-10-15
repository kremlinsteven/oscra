import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Two-tone headline: `fade` in stone grey, `ink` in black. */
export function Headline({ fade, ink, as = "h2", size = "headline", className = "" }: { fade: string; ink: string; as?: "h1" | "h2"; size?: "display" | "headline"; className?: string }) {
  const Tag = as;
  return (
    <Tag className={`${size} ${className}`}>
      <span className="fade">{fade}</span> {ink}
    </Tag>
  );
}

export function Cta({ href, children, kind = "ink" }: { href: string; children: React.ReactNode; kind?: "ink" | "ghost" | "lime" }) {
  return (
    <Link href={href} className={`btn btn-${kind}`}>
      {children}
      {kind === "ink" ? (
        <span className="dot-arrow">
          <ArrowUpRight size={13} />
        </span>
      ) : (
        <ArrowUpRight size={14} />
      )}
    </Link>
  );
}

/** Page opening for inner pages: tag, headline, lead, optional actions, optional right column. */
export function PageHead({ tag, fade, ink, lead, children, aside }: { tag: string; fade: string; ink: string; lead: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="shell grid grid-cols-1 gap-10 pt-16 pb-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end lg:pt-24">
      <div>
        <span className="tag">{tag}</span>
        <Headline as="h1" size="display" fade={fade} ink={ink} className="mt-6" />
        <p className="lead mt-6 max-w-[56ch]">{lead}</p>
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
      </div>
      {aside ? <div className="min-w-0">{aside}</div> : null}
    </section>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 font-mono text-[11px] tracking-[0.04em] text-mute">{children}</p>;
}
