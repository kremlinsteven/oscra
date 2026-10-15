import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/connect-guide",
  title: `Wallet and Permissions Guide | ${BRAND.name}`,
  description: `Exactly what ${BRAND.name} can and cannot do with your wallet: the USDG allowance, sell approvals, how to revoke them, and where exchange keys stand.`,
});

export default function ConnectGuidePage() {
  return (
    <ProsePage tag="Permissions guide" fade="Every permission," ink="and how to take it back." updated="15 Oct 2026">
      <h2>Connecting shares an address, nothing more</h2>
      <p>Connecting a wallet tells the site your public address so it can read balances. It does not let the site move anything. Every action that moves funds is a transaction your wallet shows you first.</p>
      <h2>The USDG allowance</h2>
      <p>
        Plans and buy copies need permission to pull USDG from your wallet: an ERC-20 allowance to the OscraRunbook contract. The workspace offers an allowance equal to your plan budget, or an unlimited
        one if you prefer fewer approvals. The contract can pull only what a due order allows, and only for your own plans and follows.
      </p>
      <h2>Sell approvals</h2>
      <p>To copy a sell idea, the Runbook needs an allowance on that stock token. It then sells only the share of what you copied from that desk, and returns the USDG to you in the same transaction.</p>
      <h2>Revoking</h2>
      <ul>
        <li>Workspace overview: &ldquo;Set allowance to zero&rdquo; for USDG.</li>
        <li>Any allowance can also be cleared from the explorer or a wallet&apos;s token-approval screen.</li>
        <li>Holding or closing a plan, or unfollowing a desk, stops it without touching allowances.</li>
      </ul>
      <h2>Exchange API keys</h2>
      <p>
        {BRAND.name} does not ask for exchange API keys in this release and stores none. If centralized exchange connections are added, they will use trading-only keys with withdrawals disabled, kept
        encrypted in your browser and never sent to a {BRAND.name} server.
      </p>
    </ProsePage>
  );
}
