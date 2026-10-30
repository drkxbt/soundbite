import { test } from "node:test";
import assert from "node:assert/strict";
import { TIERS, unlock } from "../dist/tiers.js";

test("four sizes: 360p and 720p free with the credit, 1080p and 1440p crowned, clean and behind ads", () => {
  assert.deepEqual(TIERS.map((tier) => tier.short), [360, 720, 1080, 1440]);
  const [small, medium, full, large] = TIERS;
  for (const free of [small, medium]) {
    assert.equal(free.ads, 0);
    assert.ok(!free.premium && !free.clean);
  }
  assert.equal(full.ads, 1);
  assert.equal(large.ads, 2);
  for (const paid of [full, large]) assert.ok(paid.premium && paid.clean);
  assert.match(full.note, /30 s/);
  assert.match(large.note, /1–2 min/);
});

test("a free size asks for no ad", async () => {
  let asked = 0;
  assert.equal(await unlock(TIERS[1], async () => (asked++, "granted")), "granted");
  assert.equal(asked, 0);
});

test("1440p plays its two ads one after the other", async () => {
  let asked = 0;
  assert.equal(await unlock(TIERS[3], async () => (asked++, "granted")), "granted");
  assert.equal(asked, 2);
});

test("an ad closed early stops there, and the size stays locked", async () => {
  let asked = 0;
  assert.equal(await unlock(TIERS[3], async () => (asked++, "closed")), "closed");
  assert.equal(asked, 1);
});
