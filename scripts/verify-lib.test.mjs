// Tests for scripts/verify-lib.mjs against a fake chain built from this repository's artifacts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeFunctionData, encodeAbiParameters, encodeFunctionResult } from "viem";
import { verifyDeployment, USDG, ROUTER, RUNBOOK_TYPES, KEEL_TYPES } from "./verify-lib.mjs";

const ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts;
const RUNBOOK = "0x00000000000000000000000000000000000000a1";
const KEEL = "0x00000000000000000000000000000000000000b2";
const TOKEN = "0x00000000000000000000000000000000000000c3";
const DEPLOYER = "0x00000000000000000000000000000000000000d4";
const RB_TX = "0x" + "11".repeat(32);
const KL_TX = "0x" + "22".repeat(32);
const LANES = [
  { symbol: "ETH", asset: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", feed: "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9", poolFee: 100, maxAge: 93600, decimals: 18 },
  { symbol: "NVDA", asset: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", poolFee: 500, maxAge: 345600, decimals: 18 },
];
const TERMS = { feeBps: 20, holderFeeBps: 10, holderMin: 250_000n * 10n ** 18n, proposerMin: 500_000n * 10n ** 18n };

const word = (v) => (typeof v === "string" ? v.toLowerCase().replace("0x", "").padStart(64, "0") : BigInt(v).toString(16).padStart(64, "0"));
function runtime(kind, values) {
  let out = ART[kind].runtime.slice(2);
  for (const r of ART[kind].immutables) {
    const w = word(values[r.name]).slice(64 - r.length * 2);
    out = out.slice(0, r.start * 2) + w + out.slice((r.start + r.length) * 2);
  }
  return "0x" + out;
}

const rbValues = { dollar: USDG, router: ROUTER, dollarUnit: 1_000_000n, minSpend: 1_000_000n, feeBps: 20n, holderFeeBps: 10n, holderMin: TERMS.holderMin, binder: DEPLOYER };
const klValues = { token: TOKEN, dollar: USDG, proposerMin: TERMS.proposerMin };
const rbArgs = (lanes = LANES, terms = TERMS) => encodeAbiParameters(RUNBOOK_TYPES, [USDG, ROUTER, lanes.map((l) => ({ asset: l.asset, poolFee: l.poolFee, feed: l.feed, maxAge: l.maxAge })), BigInt(terms.feeBps), BigInt(terms.holderFeeBps), BigInt(terms.holderMin)]).slice(2);

/** A chain where everything matches; `patch` changes one piece to simulate an attack or an outage. */
function chain(patch = {}) {
  const st = {
    rbCode: runtime("OscraRunbook", rbValues),
    klCode: runtime("OscraKeel", klValues),
    rbInput: ART.OscraRunbook.creation + rbArgs(),
    klInput: ART.OscraKeel.creation + encodeAbiParameters(KEEL_TYPES, [TOKEN, USDG, TERMS.proposerMin]).slice(2),
    storedLanes: LANES,
    sink: KEEL,
    rbStatus: "0x1",
    rbTo: null,
    rbCreated: RUNBOOK,
    fail: null,
    ...patch,
  };
  return async (method, params) => {
    if (st.fail === method) throw new Error("upstream down");
    if (method === "eth_chainId") return "0x1237";
    if (method === "eth_getCode") return params[0] === RUNBOOK ? st.rbCode : params[0] === KEEL ? st.klCode : "0x";
    if (method === "eth_getTransactionByHash") return params[0] === RB_TX ? { from: DEPLOYER, to: st.rbTo, input: st.rbInput } : params[0] === KL_TX ? { from: DEPLOYER, to: null, input: st.klInput } : null;
    if (method === "eth_getTransactionReceipt") return params[0] === RB_TX ? { status: st.rbStatus, contractAddress: st.rbCreated } : params[0] === KL_TX ? { status: "0x1", contractAddress: KEEL } : null;
    if (method === "eth_call") {
      const abi = ART.OscraRunbook.abi;
      const { functionName, args } = decodeFunctionData({ abi, data: params[0].data });
      if (st.fail === functionName) return "0x";
      if (functionName === "laneCount") return encodeFunctionResult({ abi, functionName, result: BigInt(st.storedLanes.length) });
      if (functionName === "laneAt") {
        const l = st.storedLanes[Number(args[0])];
        return encodeFunctionResult({ abi, functionName, result: { asset: l.asset, poolFee: l.poolFee, feed: l.feed, maxAge: l.maxAge, assetUnit: 10n ** 18n, feedUnit: 10n ** 8n } });
      }
      if (functionName === "sink") return encodeFunctionResult({ abi, functionName, result: st.sink });
    }
    throw new Error(`unexpected ${method}`);
  };
}

const run = (rpc, over = {}) => verifyDeployment({ runbook: RUNBOOK, runbookTx: RB_TX, keel: KEEL, keelTx: KL_TX, token: TOKEN, terms: TERMS, lanes: LANES, rpc, ART, ...over });

test("a matching deployment passes", async () => {
  const r = await run(chain());
  assert.equal(r.ok, true, r.lines.join("\n"));
});

test("missing creation transaction is a FAIL, not INFO", async () => {
  const r = await run(chain(), { runbookTx: undefined });
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.startsWith("FAIL") && l.includes("creation transaction hash is required")));
});

test("lanes in storage that differ from the config fail even when the code matches", async () => {
  const evil = [{ ...LANES[0], feed: "0x00000000000000000000000000000000000000ee" }, LANES[1]];
  const r = await run(chain({ storedLanes: evil }));
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.startsWith("FAIL lane 0")));
});

test("constructor arguments in the creation input must match exactly", async () => {
  const evil = [{ ...LANES[0], maxAge: 10_000_000 }, LANES[1]];
  const r = await run(chain({ rbInput: ART.OscraRunbook.creation + rbArgs(evil) }));
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.includes("creation input differs")));
});

test("a wrong immutable fails (fee rate)", async () => {
  const r = await run(chain({ rbCode: runtime("OscraRunbook", { ...rbValues, feeBps: 100n }) }));
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.startsWith("FAIL OscraRunbook.feeBps")));
});

test("a binder that is not the deploying wallet fails", async () => {
  const r = await run(chain({ rbCode: runtime("OscraRunbook", { ...rbValues, binder: "0x00000000000000000000000000000000000000ff" }) }));
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.startsWith("FAIL OscraRunbook.binder")));
});

test("an immutable with no expected value fails closed", async () => {
  const art = structuredCopy(ART);
  art.OscraKeel.immutables = [...art.OscraKeel.immutables, { ...art.OscraKeel.immutables[0], name: "surprise" }];
  const r = await verifyDeployment({ runbook: RUNBOOK, runbookTx: RB_TX, keel: KEEL, keelTx: KL_TX, token: TOKEN, terms: TERMS, lanes: LANES, rpc: chain(), ART: art });
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.includes("surprise") && l.startsWith("FAIL")));
});

test("failed, misdirected or recipient-carrying creation txs fail", async () => {
  for (const patch of [{ rbStatus: "0x0" }, { rbCreated: "0x00000000000000000000000000000000000000ab" }, { rbTo: RUNBOOK }]) {
    const r = await run(chain(patch));
    assert.equal(r.ok, false, JSON.stringify(patch));
  }
});

test("RPC errors and empty answers fail closed", async () => {
  for (const f of ["eth_getCode", "eth_getTransactionReceipt", "laneAt", "sink", "eth_chainId"]) {
    const r = await run(chain({ fail: f }));
    assert.equal(r.ok, false, f);
  }
});

test("a Runbook bound to another sink fails", async () => {
  const r = await run(chain({ sink: "0x00000000000000000000000000000000000000ee" }));
  assert.equal(r.ok, false);
});

test("Keel with the wrong token fails", async () => {
  const r = await run(chain({ klCode: runtime("OscraKeel", { ...klValues, token: "0x00000000000000000000000000000000000000ee" }) }));
  assert.equal(r.ok, false);
});

/** Deep copy for plain JSON data. */
function structuredCopy(v) {
  return JSON.parse(JSON.stringify(v));
}
