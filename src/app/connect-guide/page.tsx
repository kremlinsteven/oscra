import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/connect-guide",
  title: `Wallet and Permissions Guide | ${BRAND.name}`,
  description: `Exactly what ${BRAND.name} can and cannot do with your wallet: recurring orders, copied swaps, signed records, how to stop each, and where exchange keys stand.`,
});

export default function ConnectGuidePage() {
  return (
    <ProsePage tag="Permissions guide" fade="Every permission," ink="and how to take it back." updated="16 Oct 2026">
      <h2>Connecting shares an address, nothing more</h2>
      <p>Connecting a wallet tells the site your public address so it can read balances. It does not let the site move anything. Every action that moves funds is a transaction your wallet shows you first.</p>
      <h2>No standing approvals</h2>
      <p>
        {BRAND.name} never asks for a token delegate or an unlimited approval. Every action that moves funds is a single transaction your wallet shows you at that moment, built by Jupiter and signed by you.
      </p>
      <h2>Recurring buys</h2>
      <p>
        Creating a recurring buy moves the plan&apos;s USDC into a Jupiter Recurring order account tied to your wallet. Only your wallet can cancel it; cancelling returns the unspent USDC and everything already
        bought. Jupiter&apos;s keepers fill the orders; {BRAND.name} cannot touch the account.
      </p>
      <h2>Copied trades</h2>
      <p>Each copy is one Jupiter swap from your wallet to your wallet. A sell copy sells only the share of what you copied from that desk, never more than the wallet holds.</p>
      <h2>Signatures that move nothing</h2>
      <p>
        Follows, desk ideas, skips and votes are messages your wallet signs. The message says it moves no funds; the server checks the signature and a one-time nonce and stores the record. Wallets show these
        as a plain text signature, not a transaction.
      </p>
      <h2>How to stop</h2>
      <ul>
        <li>Recurring buys: &ldquo;Cancel and withdraw&rdquo; on each order.</li>
        <li>Copy desks: &ldquo;Unfollow&rdquo;. Ideas from that desk stop appearing.</li>
        <li>Disconnect from the account menu at any time; nothing keeps running on your behalf except Jupiter orders you created.</li>
      </ul>
      <h2>Exchange API keys</h2>
      <p>
        {BRAND.name} does not ask for exchange API keys in this release and stores none. If centralized exchange connections are added, they will use trading-only keys with withdrawals disabled, kept
        encrypted in your browser and never sent to a {BRAND.name} server.
      </p>
    </ProsePage>
  );
}
