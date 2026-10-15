import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/privacy",
  title: `Privacy Policy | ${BRAND.name}`,
  description: `What ${BRAND.name} collects and keeps: no accounts, no emails, no exchange keys; a few rate-limit counters and data your own browser stores.`,
});

export default function PrivacyPage() {
  return (
    <ProsePage tag="Legal" fade="Privacy" ink="policy." updated="15 Oct 2026">
      <p>{BRAND.name} has no user accounts. There is no sign-up, no email address and no password, and the site asks for no exchange API keys.</p>
      <h2>What the server sees</h2>
      <p>
        To keep the public data relay fair, the server counts requests per network address in short-lived counters that expire within minutes. It does not log wallet addresses with them and does not sell
        or share data.
      </p>
      <h2>What your browser keeps</h2>
      <p>Your last connected wallet, your practice book and your deploy progress (owner tool) are stored in your browser&apos;s local storage. Clearing site data removes them.</p>
      <h2>Public blockchain data</h2>
      <p>Transactions you send on Robinhood Chain are public by nature. Plans, follows, ideas and stakes are visible on the explorer to anyone.</p>
      <h2>Third parties</h2>
      <p>The site reads public data from Robinhood Chain RPC providers and OKX market data. Wallets you connect have their own privacy policies.</p>
      <h2>Contact</h2>
      <p>
        Questions: <a href={BRAND.x}>{BRAND.xHandle}</a> on X.
      </p>
    </ProsePage>
  );
}
