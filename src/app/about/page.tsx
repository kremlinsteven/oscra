import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/about",
  title: `About | ${BRAND.name}`,
  description: `Why ${BRAND.name} exists: automation that traders can read, on money that stays in their own wallet on Robinhood Chain.`,
});

export default function AboutPage() {
  return (
    <ProsePage tag="About" fade="Automation you can read," ink="on money you keep.">
      <p>
        Most traders end up choosing between two bad options. Trading by hand means watching charts at night and still acting on mood. Handing funds to an automated service means trusting rules you
        cannot see, on an account someone else controls.
      </p>
      <p>
        {BRAND.name} takes a third path. The rules live in a public contract on Robinhood Chain, the money stays in your wallet until the moment an order fills, and every limit you set is shown next to the
        position it protects.
      </p>
      <h2>What we build</h2>
      <ul>
        <li>A trade review that explains a market with numbers you can check.</li>
        <li>Recurring buys with ceilings, pauses and budgets enforced on-chain.</li>
        <li>Copy desks where the follower&apos;s caps decide what each idea may spend.</li>
        <li>A staking contract that passes every fee to {BRAND.symbol} stakers.</li>
      </ul>
      <h2>What we will not do</h2>
      <ul>
        <li>Hold customer funds, or ask for exchange withdrawal rights.</li>
        <li>Show simulated returns as if they were results.</li>
        <li>Keep an admin key that could change a live contract.</li>
      </ul>
      <h2>Where to follow along</h2>
      <p>
        News and launch details are posted on X at <a href={BRAND.x}>{BRAND.xHandle}</a>. The code of this site and its contracts will be published in a public repository.
      </p>
    </ProsePage>
  );
}
