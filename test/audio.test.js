import { test } from "node:test";
import assert from "node:assert/strict";
import { isSilent } from "../dist/audio.js";

test("a stretch with no sound is silent, and speech-level sound is not", () => {
  assert.equal(isSilent(new Float32Array(16000 * 5)), true);
  assert.equal(isSilent(Float32Array.from({ length: 16000 * 5 }, (_, i) => (Math.random() - 0.5) * 0.002)), true);
  assert.equal(isSilent(Float32Array.from({ length: 16000 * 5 }, (_, i) => Math.sin(i / 8) * 0.2)), false);
  assert.equal(isSilent(new Float32Array(0)), true);
});
