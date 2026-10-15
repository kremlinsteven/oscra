import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeployPanel } from "@/components/deploy/DeployPanel";
import ART from "@/lib/contracts/artifacts.json";

export const metadata: Metadata = {
  title: "Deploy contracts",
  description: "Owner tool: deploy the OSCRA contracts from your own wallet.",
  robots: { index: false, follow: false },
};

// Owner tool, local only: on any public host this route is a 404.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const host = (await headers()).get("host") ?? "";
  if (!LOCAL_HOST.test(host)) notFound();
  return (
    <main className="shell max-w-4xl pt-14 pb-24">
      <span className="tag">Owner tool · this machine only</span>
      <h1 className="display mt-5">Deploy the contracts</h1>
      <p className="lead mt-5">
        Three transactions signed in your wallet on Robinhood Chain: the Runbook now, the Keel once the token address is in src/config/brand.ts, then one bind call. Nothing here holds a key.
        Progress is kept in this browser, so a reload does not lose an address.
      </p>
      <div className="mt-8">
        <DeployPanel
          runbook={{ creation: ART.contracts.OscraRunbook.creation, sha256: ART.contracts.OscraRunbook.sha256 }}
          keel={{ creation: ART.contracts.OscraKeel.creation, sha256: ART.contracts.OscraKeel.sha256 }}
        />
      </div>
    </main>
  );
}
