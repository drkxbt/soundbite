import { test } from "node:test";
import assert from "node:assert/strict";
import { isSilent } from "../dist/audio.js";

test("a stretch with no sound is silent, and speech-level sound is not", () => {
  assert.equal(isSilent(new Float32Array(16000 * 5)), true);
  assert.equal(isSilent(Float32Array.from({ length: 16000 * 5 }, (_, i) => (Math.random() - 0.5) * 0.002)), true);
  assert.equal(isSilent(Float32Array.from({ length: 16000 * 5 }, (_, i) => Math.sin(i / 8) * 0.2)), false);
  assert.equal(isSilent(new Float32Array(0)), true);
});

test("a few seconds of quiet speech in two minutes of silence is not silence", () => {
  const samples = new Float32Array(16000 * 120);
  for (let i = 16000 * 60; i < 16000 * 63; i++) samples[i] = Math.sin(i / 8) * 0.028;
  assert.equal(isSilent(samples), false);
});
