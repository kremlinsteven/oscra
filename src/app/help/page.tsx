import Link from "next/link";
import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/help",
  title: `Help Center | ${BRAND.name}`,
  description: `Step-by-step help for ${BRAND.name}: connect a Solana wallet, get USDC, write a recurring buy, follow a desk and stop everything.`,
});

export default function HelpPage() {
  return (
    <ProsePage tag="Help center" fade="From first connect" ink="to first plan.">
      <h2>1. Connect a wallet</h2>
      <p>
        Press Connect in the top bar. Every Solana wallet installed in your browser is listed (Phantom, Solflare, Backpack and others). If none is found, the dialog links to install one. Connecting shares
        your address only.
      </p>
      <h2>2. Get SOL and USDC</h2>
      <p>You need a little SOL for network fees and USDC for orders. Buy SOL on an exchange and withdraw it to your wallet on Solana, then swap part of it to USDC in your wallet.</p>
      <h2>3. Practice first</h2>
      <p>
        Every <Link href="/app">workspace</Link> screen has a Practice tab with 10,000 practice USDC. Use +1 h and +1 day to move the practice clock and watch due buys, pauses and copy windows
        without sending anything.
      </p>
      <h2>4. Write a recurring buy</h2>
      <p>
        Under Recurring buys, pick a market, the USDC per order (at least 50), the number of orders and the pace, and an optional price range. Your wallet signs one Jupiter order; cancel it any time to get the
        rest back.
      </p>
      <h2>5. Follow a desk</h2>
      <p>
        Under Copy desks, paste the desk&apos;s Solana address and set your per-idea amount, daily cap, review delay and stop, then sign the follow (free). New ideas land in your inbox; skip any you dislike, and
        copy the rest with one Jupiter swap each.
      </p>
      <h2>6. Stop everything</h2>
      <p>
        Cancel your recurring orders under Recurring buys and unfollow your desks. Nothing else can spend from your wallet: there are no standing approvals. See the{" "}
        <Link href="/connect-guide">permissions guide</Link>.
      </p>
    </ProsePage>
  );
}
