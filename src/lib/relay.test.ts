import { test } from "node:test";
import assert from "node:assert/strict";
import { USDC } from "@/config/brand";
import { LANES } from "@/config/lanes";
import { checkBatch, runRelay } from "./relay";

const OWNER = "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE";

test("plain reads are priced", () => {
  const out = checkBatch([{ method: "getBalance", params: [OWNER] }]);
  assert.ok("units" in out && out.units === 1);
});

test("sending, simulating and unknown methods are refused", () => {
  for (const method of ["sendTransaction", "simulateTransaction", "getProgramAccounts", "requestAirdrop", "getBlock"]) {
    assert.ok("error" in checkBatch([{ method, params: [] }]), method);
  }
});

test("token account queries need a mint filter for a mint the site reads", () => {
  const q = (filter: unknown) => checkBatch([{ method: "getTokenAccountsByOwner", params: [OWNER, filter, { encoding: "jsonParsed" }] }]);
  assert.ok("units" in q({ mint: USDC.mint }));
  assert.ok("units" in q({ mint: LANES[3].mint }));
  assert.ok("error" in q({ programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }));
  assert.ok("error" in q({ mint: "So11111111111111111111111111111111111111113" }));
  assert.ok("error" in q({ mint: USDC.mint, programId: "x" }));
});

test("list sizes and signature history are capped", () => {
  assert.ok("error" in checkBatch([{ method: "getMultipleAccounts", params: [Array(21).fill(OWNER)] }]));
  assert.ok("error" in checkBatch([{ method: "getSignaturesForAddress", params: [OWNER] }]));
  assert.ok("error" in checkBatch([{ method: "getSignaturesForAddress", params: [OWNER, { limit: 500 }] }]));
  assert.ok("units" in checkBatch([{ method: "getSignaturesForAddress", params: [OWNER, { limit: 20 }] }]));
  assert.ok("error" in checkBatch(Array(21).fill({ method: "getSlot", params: [] })));
});

test("unknown config fields and bad addresses are refused", () => {
  assert.ok("error" in checkBatch([{ method: "getAccountInfo", params: [OWNER, { filters: [] }] }]));
  assert.ok("error" in checkBatch([{ method: "getAccountInfo", params: ["0x1234"] }]));
  assert.ok("error" in checkBatch([{ method: "getAccountInfo", params: [OWNER, { encoding: "binary-blob" }] }]));
});

test("a refused budget never reaches the RPC", async () => {
  let reached = false;
  const out = await runRelay({ method: "getSlot", params: [] }, {
    charge: async () => "slow down",
    one: async () => {
      reached = true;
      return { result: 1 };
    },
    many: async () => [],
  });
  assert.equal(out.status, 429);
  assert.equal(reached, false);
});

test("a malformed request is refused before the budget and the RPC", async () => {
  let charged = false;
  const out = await runRelay({ method: "getTokenAccountsByOwner", params: [OWNER, {}] }, {
    charge: async () => {
      charged = true;
      return null;
    },
    one: async () => ({ result: null }),
    many: async () => [],
  });
  assert.equal(out.status, 400);
  assert.equal(charged, false);
});

test("inherited object names are not methods", () => {
  for (const method of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.ok("error" in checkBatch([{ method, params: [] }]), method);
  }
});
