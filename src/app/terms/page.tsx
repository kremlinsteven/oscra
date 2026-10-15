import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/terms",
  title: `Terms of Use | ${BRAND.name}`,
  description: `The terms for using the ${BRAND.name} website and workspace: self-custody software, no advice, your own responsibility for transactions you sign.`,
});

export default function TermsPage() {
  return (
    <ProsePage tag="Legal" fade="Terms" ink="of use." updated="16 Oct 2026">
      <p>By using this website and workspace you accept these terms. If you do not, please do not use them.</p>
      <h2>What {BRAND.name} is</h2>
      <p>
        {BRAND.name} is software. The website helps you prepare transactions that you sign with your own wallet, built by third-party Solana protocols (Jupiter) and sent from your wallet. {BRAND.name} does not hold your funds,
        does not act as a broker or adviser, and cannot reverse a transaction.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Keep your wallet and keys safe; nobody can recover them for you.</li>
        <li>Check every transaction in your wallet before you sign it.</li>
        <li>Make sure using these tools and the assets involved is lawful where you live.</li>
      </ul>
      <h2>No advice</h2>
      <p>Reviews, examples and practice results are information, not recommendations. Decisions and their consequences are yours.</p>
      <h2>No warranty</h2>
      <p>The software is provided as is. Third-party protocols can have flaws, networks can stall, prices can gap through any limit, and third-party tokens can be paused or blocked by their issuers.</p>
      <h2>Changes</h2>
      <p>These terms may change; the date above shows the latest version.</p>
    </ProsePage>
  );
}
