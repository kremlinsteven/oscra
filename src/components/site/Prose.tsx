import { Headline } from "@/components/site/Blocks";

/** Text page: tag, headline, then a readable column. */
export function ProsePage({ tag, fade, ink, updated, children }: { tag: string; fade: string; ink: string; updated?: string; children: React.ReactNode }) {
  return (
    <main className="shell pt-16 pb-10 lg:pt-24">
      <span className="tag">{tag}</span>
      <Headline as="h1" size="display" fade={fade} ink={ink} className="mt-6 max-w-[18ch]" />
      {updated ? <p className="mt-4 font-mono text-[12px] text-mute">Updated {updated}</p> : null}
      <div className="prose-oscra mt-10 max-w-[720px] text-[15.5px]">{children}</div>
    </main>
  );
}
