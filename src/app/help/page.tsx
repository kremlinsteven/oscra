import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/help",
  title: `Help Center | ${BRAND.name}`,
  description: `Step-by-step help for ${BRAND.name}: connect a wallet, get USDG on Robinhood Chain, write a plan, follow a desk and stop everything with one allowance.`,
});

export default function HelpPage() {
  return (
    <ProsePage tag="Help center" fade="From first connect" ink="to first plan.">
      <h2>1. Connect a wallet</h2>
      <p>
        Press Connect in the top bar. Detected browser wallets are listed first; phone wallets work through WalletConnect when the site has it configured. The first connect adds Robinhood Chain (chain
        id 4663) to your wallet. Phantom cannot add custom networks, so it is shown but disabled.
      </p>
      <h2>2. Get ETH and USDG on Robinhood Chain</h2>
      <p>You need a little ETH for gas and USDG for orders. Bridge ETH to Robinhood Chain, then swap part of it to USDG on a Robinhood Chain exchange.</p>
      <h2>3. Try it in practice</h2>
      <p>
        Until the Runbook contract is deployed, the <Link href="/app">workspace</Link> runs in practice mode with 10,000 practice USDG. Use +1 h and +1 day to move the practice clock and watch due buys,
        pauses and copy windows behave.
      </p>
      <h2>4. Write a plan</h2>
      <p>
        Under Recurring buys, pick a market, the order size, the pace and a budget. Add a price ceiling, a drawdown guard or a target if you want them. When the contract is live, approve USDG once and
        open the plan from your wallet.
      </p>
      <h2>5. Follow a desk</h2>
      <p>Under Copy desks, paste the desk&apos;s wallet address and set your per-idea amount, daily cap, review delay and stop. New ideas land in your inbox; skip any you dislike before the window opens.</p>
      <h2>6. Stop everything</h2>
      <p>
        On the workspace overview, set the USDG allowance to zero. No plan or follow can spend after that. See the <Link href="/connect-guide">permissions guide</Link> for details.
      </p>
    </ProsePage>
  );
}
