// Checks behind scripts/verify-deployment.mjs, free of I/O so they can be tested with a fake chain.
//
// How it decides that addresses run this repository's OSCRA contracts. Every check fails closed: an RPC error,
// an empty or malformed answer is a FAIL, never a skip.
//   1. Runtime code is compared byte for byte with src/lib/contracts/artifacts.json; only immutables may differ.
//   2. EVERY immutable named in artifacts.json is decoded and compared with its expected value. An immutable this
//      file does not know how to check is a FAIL (a new immutable cannot slip through unchecked).
//   3. The creation transaction is REQUIRED: it must have succeeded, have no recipient, have created exactly the
//      address checked, and its input must equal this build's creation code followed by exactly the expected
//      constructor arguments. That also proves every constructor value that lives in storage (the Runbook lanes).
//   4. Storage is read back as well: laneCount and every laneAt(i) must equal the lanes in src/config/lanes.ts,
//      and the Runbook's sink must be empty or the Keel given.
import { decodeFunctionResult, encodeAbiParameters, encodeFunctionData } from "viem";

export const CHAIN_ID = 4663;
export const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";

const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const isHash = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const slice = (hex, start, length) => hex.slice(2 + start * 2, 2 + (start + length) * 2);
const put = (hex, ranges, bytes) => {
  let out = hex.slice(2);
  for (const r of ranges) out = out.slice(0, r.start * 2) + bytes(r) + out.slice((r.start + r.length) * 2);
  return "0x" + out;
};
const asAddr = (word) => "0x" + word.slice(24);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const num = (hex) => BigInt("0x" + hex);

export const LANE_TUPLE = { type: "tuple[]", components: [{ type: "address", name: "asset" }, { type: "uint24", name: "poolFee" }, { type: "address", name: "feed" }, { type: "uint32", name: "maxAge" }] };
export const RUNBOOK_TYPES = [{ type: "address" }, { type: "address" }, LANE_TUPLE, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }];
export const KEEL_TYPES = [{ type: "address" }, { type: "address" }, { type: "uint256" }];

/** { immutables } when `code` is this build's `kind` apart from immutables, else null. */
export function match(ART, kind, code) {
  const a = ART[kind];
  code = String(code).toLowerCase();
  if (!a || code.length !== a.runtime.length) return null;
  const immutables = {};
  for (const r of a.immutables) {
    const v = slice(code, r.start, r.length);
    if (immutables[r.name] !== undefined && immutables[r.name] !== v) return null;
    immutables[r.name] = v;
  }
  return put(a.runtime, a.immutables, (r) => immutables[r.name]) === code ? { immutables } : null;
}

/**
 * input: { runbook, runbookTx, keel?, keelTx?, token?, terms: { feeBps, holderFeeBps, holderMin, proposerMin }, lanes, rpc, ART }
 * lanes: [{ asset, poolFee, feed, maxAge, decimals }] in constructor order. rpc(method, params) -> result (may throw).
 */
export async function verifyDeployment({ runbook, runbookTx, keel, keelTx, token, terms, lanes, rpc, ART }) {
  const lines = [];
  let failed = false;
  const ok = (m) => lines.push(`OK   ${m}`);
  const info = (m) => lines.push(`INFO ${m}`);
  const fail = (m) => {
    failed = true;
    lines.push(`FAIL ${m}`);
  };
  const done = () => ({ ok: !failed, lines });
  const code = async (a) => {
    const c = await rpc("eth_getCode", [a, "latest"]);
    if (!isHex(c) || c.length <= 2) throw new Error(`no code at ${a}`);
    return c;
  };
  const view = async (to, abi, fn, args = []) => {
    const raw = await rpc("eth_call", [{ to, data: encodeFunctionData({ abi, functionName: fn, args }) }, "latest"]);
    if (!isHex(raw) || raw.length <= 2) throw new Error(`${fn}: empty answer`);
    return decodeFunctionResult({ abi, functionName: fn, data: raw });
  };

  /** Asserts every immutable of `kind`; unknown names fail. */
  const immutables = (kind, found, expect) => {
    for (const name of new Set(ART[kind].immutables.map((r) => r.name))) {
      const check = expect[name];
      if (!check) {
        fail(`${kind}.${name}: no expected value in verify-lib (refusing to pass an unchecked immutable)`);
        continue;
      }
      const [okay, label] = check(found.immutables[name]);
      if (okay) ok(`${kind}.${name} ${label}`);
      else fail(`${kind}.${name} ${label}`);
    }
  };

  /** Required creation-transaction check. */
  const creation = async (kind, hash, address, types, values) => {
    if (!isHash(hash)) return fail(`${kind}: the creation transaction hash is required (--${kind === "OscraRunbook" ? "runbook" : "keel"}-tx)`);
    try {
      const [tx, rc] = await Promise.all([rpc("eth_getTransactionByHash", [hash]), rpc("eth_getTransactionReceipt", [hash])]);
      if (!tx || typeof tx !== "object" || !rc || typeof rc !== "object") return fail(`${kind}: creation tx ${hash} not found`);
      if (rc.status !== "0x1") return fail(`${kind}: creation tx did not succeed`);
      if (tx.to !== null && tx.to !== undefined) return fail(`${kind}: tx has a recipient, not a deployment`);
      if (!isAddr(rc.contractAddress) || !same(rc.contractAddress, address)) return fail(`${kind}: tx created ${rc.contractAddress}, not ${address}`);
      const args = encodeAbiParameters(types, values).slice(2);
      if (String(tx.input).toLowerCase() === (ART[kind].creation + args).toLowerCase()) ok(`${kind}: creation input is this build plus exactly the expected constructor arguments`);
      else fail(`${kind}: creation input differs (code or constructor arguments)`);
      return tx;
    } catch (e) {
      fail(`${kind}: creation tx unreadable: ${e.message}`);
    }
  };

  try {
    const id = await rpc("eth_chainId", []);
    if (!isHex(id) && typeof id !== "string") throw new Error("empty answer");
    if (Number(BigInt(id)) !== CHAIN_ID) return fail(`chain id ${id}, expected ${CHAIN_ID}`), done();
    ok(`chain id ${CHAIN_ID} (Robinhood Chain)`);
  } catch (e) {
    fail(`chain id unreadable: ${e.message}`);
    return done();
  }
  if (!isAddr(runbook)) return fail("--runbook must be an address"), done();
  if (keel !== undefined && !isAddr(keel)) return fail("--keel must be an address"), done();
  if (!Array.isArray(lanes) || lanes.length === 0) return fail("no lanes configured"), done();

  // ---------------------------------------------------------------- OscraRunbook
  const runbookAbi = ART.OscraRunbook.abi;
  let rb = null;
  try {
    rb = match(ART, "OscraRunbook", await code(runbook));
  } catch (e) {
    fail(`OscraRunbook: ${e.message}`);
  }
  let deployer = null;
  if (!rb) fail(`OscraRunbook at ${runbook}: runtime differs from this build (or unreadable)`);
  else {
    ok(`OscraRunbook at ${runbook}: runtime matches this build`);
    const tx = await creation("OscraRunbook", runbookTx, runbook, RUNBOOK_TYPES, [
      USDG,
      ROUTER,
      lanes.map((l) => ({ asset: l.asset, poolFee: l.poolFee, feed: l.feed, maxAge: l.maxAge })),
      BigInt(terms.feeBps),
      BigInt(terms.holderFeeBps),
      BigInt(terms.holderMin),
    ]);
    deployer = tx && isAddr(tx.from) ? tx.from : null;
    immutables("OscraRunbook", rb, {
      dollar: (v) => [same(asAddr(v), USDG), `is ${asAddr(v)} (want USDG)`],
      router: (v) => [same(asAddr(v), ROUTER), `is ${asAddr(v)} (want SwapRouter02)`],
      dollarUnit: (v) => [num(v) === 1_000_000n, `is ${num(v)} (want 10^6)`],
      minSpend: (v) => [num(v) === 1_000_000n, `is ${num(v)} (want 10^6)`],
      feeBps: (v) => [num(v) === BigInt(terms.feeBps), `is ${num(v)} (want ${terms.feeBps})`],
      holderFeeBps: (v) => [num(v) === BigInt(terms.holderFeeBps), `is ${num(v)} (want ${terms.holderFeeBps})`],
      holderMin: (v) => [num(v) === BigInt(terms.holderMin), `is ${num(v)} (want ${terms.holderMin})`],
      binder: (v) => [deployer !== null && same(asAddr(v), deployer), `is ${asAddr(v)} (want the deploying wallet ${deployer ?? "unknown"})`],
    });
    // Storage written by the constructor, read back.
    try {
      const count = await view(runbook, runbookAbi, "laneCount");
      if (count !== BigInt(lanes.length)) fail(`laneCount is ${count}, want ${lanes.length}`);
      else ok(`laneCount ${count}`);
      for (let i = 0; i < lanes.length; i++) {
        const l = await view(runbook, runbookAbi, "laneAt", [BigInt(i)]);
        const want = lanes[i];
        const good = same(l.asset, want.asset) && Number(l.poolFee) === want.poolFee && same(l.feed, want.feed) && Number(l.maxAge) === want.maxAge && l.assetUnit === 10n ** BigInt(want.decimals) && l.feedUnit === 10n ** 8n;
        if (good) ok(`lane ${i}: ${want.symbol ?? want.asset} pool fee ${want.poolFee}, max feed age ${want.maxAge} s`);
        else fail(`lane ${i}: stored values differ from src/config/lanes.ts`);
      }
      const sink = await view(runbook, runbookAbi, "sink");
      if (/^0x0{40}$/i.test(sink)) info("Runbook not bound yet (fees are zero until bind)");
      else if (keel && same(sink, keel)) ok("Runbook is bound to the Keel given");
      else fail(`Runbook is bound to ${sink}, not ${keel ?? "(no --keel given)"}`);
    } catch (e) {
      fail(`OscraRunbook storage unreadable: ${e.message}`);
    }
  }

  // ---------------------------------------------------------------- OscraKeel
  if (keel) {
    if (!isAddr(token)) fail("--token (the $OSCRA address) is required with --keel");
    let kl = null;
    try {
      kl = match(ART, "OscraKeel", await code(keel));
    } catch (e) {
      fail(`OscraKeel: ${e.message}`);
    }
    if (!kl) fail(`OscraKeel at ${keel}: runtime differs from this build (or unreadable)`);
    else {
      ok(`OscraKeel at ${keel}: runtime matches this build`);
      immutables("OscraKeel", kl, {
        token: (v) => [isAddr(token) && same(asAddr(v), token), `is ${asAddr(v)} (want ${token})`],
        dollar: (v) => [same(asAddr(v), USDG), `is ${asAddr(v)} (want USDG)`],
        proposerMin: (v) => [num(v) === BigInt(terms.proposerMin), `is ${num(v)} (want ${terms.proposerMin})`],
      });
      if (isAddr(token)) await creation("OscraKeel", keelTx, keel, KEEL_TYPES, [token, USDG, BigInt(terms.proposerMin)]);
    }
  } else info("no --keel given: only the Runbook was checked");
  return done();
}
