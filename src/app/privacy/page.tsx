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
    <ProsePage tag="Legal" fade="Privacy" ink="policy." updated="16 Oct 2026">
      <p>{BRAND.name} has no user accounts. There is no sign-up, no email address and no password, and the site asks for no exchange API keys. Your wallet address is your only identifier.</p>
      <h2>What the server sees</h2>
      <p>
        To keep the public data relay fair, the server counts requests per network address in short-lived counters that expire within minutes. When you sign a record (a follow, a desk idea, a skip, a copied
        fill, a poll or a vote) the server stores it with your wallet address so the workspace can show it back. It does not sell or share data.
      </p>
      <h2>What your browser keeps</h2>
      <p>Your last connected wallet, your practice book and your real/practice tab choice are stored in your browser&apos;s local storage. Clearing site data removes them.</p>
      <h2>Public blockchain data</h2>
      <p>Transactions you send on Solana are public by nature. Recurring orders and swaps are visible on the explorer to anyone. Desk ideas and poll tallies are shown publicly on this site.</p>
      <h2>Third parties</h2>
      <p>The site reads public data from Solana RPC providers, Pyth, Jupiter, GeckoTerminal and OKX market data, and sends your order requests to Jupiter. Wallets you connect follow their own privacy rules.</p>
      <h2>Contact</h2>
      <p>
        Questions: <a href={BRAND.x}>{BRAND.xHandle}</a> on X.
      </p>
    </ProsePage>
  );
}
