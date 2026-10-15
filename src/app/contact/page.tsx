import { BRAND } from "@/config/brand";
import { ProsePage } from "@/components/site/Prose";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/contact",
  title: `Contact | ${BRAND.name}`,
  description: `How to reach the ${BRAND.name} team, report a problem with the workspace, and spot impersonators.`,
});

export default function ContactPage() {
  return (
    <ProsePage tag="Contact" fade="Talk to" ink="the team.">
      <p>
        The fastest way to reach {BRAND.name} is a message on X: <a href={BRAND.x}>{BRAND.xHandle}</a>. Announcements, launch details and the official token address are posted there and on this site
        only.
      </p>
      <h2>Reporting a problem</h2>
      <p>Describe what you did, what you expected and what happened. A transaction signature from the explorer helps more than a screenshot.</p>
      <h2>Security issues</h2>
      <p>Please report privately by direct message on X first and give us time to respond before publishing details.</p>
      <h2>We will never</h2>
      <ul>
        <li>Ask for your seed phrase or private key.</li>
        <li>Ask you to send funds to an address to &ldquo;verify&rdquo; or &ldquo;unlock&rdquo; anything.</li>
        <li>Announce a token address anywhere except this site and {BRAND.xHandle}.</li>
      </ul>
    </ProsePage>
  );
}
