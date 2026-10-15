import { BRAND } from "@/config/brand";
import { FAQ } from "@/content/faq";
import { JsonLd } from "@/components/JsonLd";
import { Headline } from "@/components/site/Blocks";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/faq",
  title: `FAQ | ${BRAND.name}`,
  description: `Answers about ${BRAND.name}: what it is, how plans and copies work, custody, markets, fees, the network and how to get ${BRAND.symbol}.`,
});

export default function FaqPage() {
  return (
    <main className="shell grid grid-cols-1 gap-10 pt-16 pb-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:pt-24">
      <JsonLd data={faqLd(FAQ)} />
      <div>
        <span className="tag">FAQ</span>
        <Headline as="h1" size="display" fade="Before" ink="you begin." className="mt-6" />
        <p className="lead mt-6">Short answers to what people ask first. The help center goes step by step.</p>
      </div>
      <div className="divide-y divide-line rounded-[22px] border border-line bg-card">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-5 py-4" open={f.q.startsWith("What is")}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold">
              {f.q}
              <span className="num text-mute transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-[14.5px] text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
