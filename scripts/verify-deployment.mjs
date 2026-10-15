// Proves that deployed addresses run exactly this repository's OSCRA contracts with the expected settings.
//   (cd contracts && ./setup.sh && forge build --force) && npm run contracts:artifacts -- --check
//   npm run verify-deployment -- --runbook 0x.. --runbook-tx 0x.. [--keel 0x.. --keel-tx 0x.. --token 0x..]
//                                [--fee-bps 20] [--holder-fee-bps 10] [--holder-min <wei>] [--proposer-min <wei>]
// The creation transactions are required. Prints OK/FAIL/INFO per check and exits non-zero on any FAIL.
// RPC: VERIFY_RPC_URL from your shell, else a public Robinhood Chain endpoint.
import { readFileSync } from "node:fs";
import { verifyDeployment } from "./verify-lib.mjs";

const RPC = process.env.VERIFY_RPC_URL || "https://robinhood.drpc.org";
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body || typeof body !== "object" || !("result" in body || "error" in body)) throw new Error("malformed JSON-RPC answer");
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/** The lanes and terms from src/config/lanes.ts (parsed as text so this script needs no TypeScript runtime). */
function readConfig() {
  const src = readFileSync(new URL("../src/config/lanes.ts", import.meta.url), "utf8");
  const ages = { CRYPTO_AGE: Number(/const CRYPTO_AGE = ([\d_]+)/.exec(src)[1].replace(/_/g, "")), STOCK_AGE: Number(/const STOCK_AGE = ([\d_]+)/.exec(src)[1].replace(/_/g, "")) };
  const lanes = [...src.matchAll(/\{ id: (\d+), symbol: "(\w+)".*?asset: "(0x[0-9a-fA-F]{40})", feed: "(0x[0-9a-fA-F]{40})", poolFee: (\d+), maxAge: (\w+), decimals: (\d+) \}/g)].map((m) => ({
    symbol: m[2],
    asset: m[3],
    feed: m[4],
    poolFee: Number(m[5]),
    maxAge: ages[m[6]] ?? Number(m[6]),
    decimals: Number(m[7]),
  }));
  const big = (re) => BigInt(re.exec(src)[1].replace(/_/g, "")) * 10n ** 18n;
  return {
    lanes,
    terms: {
      feeBps: Number(/feeBps: (\d+),/.exec(src)[1]),
      holderFeeBps: Number(/holderFeeBps: (\d+),/.exec(src)[1]),
      holderMin: big(/holderMin: ([\d_]+)n/),
      proposerMin: big(/proposerMin: ([\d_]+)n/),
    },
  };
}

if (!opt("--runbook")) {
  console.log("usage: npm run verify-deployment -- --runbook <address> --runbook-tx <hash> [--keel <address> --keel-tx <hash> --token <address>] [--fee-bps n] [--holder-fee-bps n] [--holder-min wei] [--proposer-min wei]");
  process.exit(2);
}
let ART;
try {
  ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts;
} catch {
  console.log("FAIL src/lib/contracts/artifacts.json is missing. Run: cd contracts && ./setup.sh && forge build --force && cd .. && npm run contracts:artifacts");
  process.exit(1);
}
const cfg = readConfig();
const terms = {
  feeBps: opt("--fee-bps") ?? cfg.terms.feeBps,
  holderFeeBps: opt("--holder-fee-bps") ?? cfg.terms.holderFeeBps,
  holderMin: opt("--holder-min") ?? cfg.terms.holderMin,
  proposerMin: opt("--proposer-min") ?? cfg.terms.proposerMin,
};
const result = await verifyDeployment({
  runbook: opt("--runbook"),
  runbookTx: opt("--runbook-tx"),
  keel: opt("--keel"),
  keelTx: opt("--keel-tx"),
  token: opt("--token"),
  terms,
  lanes: cfg.lanes,
  rpc,
  ART,
});
for (const l of result.lines) console.log(l);
console.log(result.ok ? "MATCH: these addresses run the OSCRA contracts from this build with the expected settings." : "MISMATCH: do not trust this deployment.");
process.exit(result.ok ? 0 : 1);
