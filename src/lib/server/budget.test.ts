import { test } from "node:test";
import assert from "node:assert/strict";
import { budget } from "@/lib/guard";

const req = (ip: string) => new Request("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

test("unknown client IPs share one site-wide ceiling; a forged header cannot mint new budgets", async () => {
  delete process.env.TRUST_PROXY_HEADERS;
  let ok = 0;
  for (let i = 0; i < 30; i++) if (await budget(null, req(`10.0.${i}.1`), "t-site", 1, 2, 10, 60)) ok++;
  assert.equal(ok, 10);
});

test("known client IPs each get their own budget", async () => {
  process.env.TRUST_PROXY_HEADERS = "1";
  try {
    assert.equal(await budget(null, req("203.0.113.7"), "t-ip", 1, 2, 1_000, 60), true);
    assert.equal(await budget(null, req("203.0.113.7"), "t-ip", 1, 2, 1_000, 60), true);
    assert.equal(await budget(null, req("203.0.113.7"), "t-ip", 1, 2, 1_000, 60), false);
    assert.equal(await budget(null, req("198.51.100.9"), "t-ip", 1, 2, 1_000, 60), true);
  } finally {
    delete process.env.TRUST_PROXY_HEADERS;
  }
});
