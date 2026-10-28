import { test } from "node:test";
import assert from "node:assert/strict";
import { Coverage, cutPoint } from "../dist/sweep.js";

test("transcribed stretches merge into one another, and their length adds up", () => {
  const coverage = new Coverage();
  coverage.add(0, 10);
  coverage.add(20, 30);
  assert.deepEqual(coverage.spans, [[0, 10], [20, 30]]);
  assert.equal(coverage.covered(), 20);
  coverage.add(10, 20);
  assert.deepEqual(coverage.spans, [[0, 30]]);
  assert.ok(coverage.has(5, 25));
  assert.ok(!coverage.has(25, 35));
});

test("the sweep goes front to back a stretch at a time, and stops when all of it is done", () => {
  const coverage = new Coverage();
  assert.deepEqual(coverage.next(100, [], 30), [0, 30]);
  coverage.add(0, 30);
  assert.deepEqual(coverage.next(100, [], 30), [30, 60]);
  coverage.add(30, 100);
  assert.equal(coverage.next(100, [], 30), null);
});

test("what the user is looking at goes first, and a stretch stops where transcribed audio begins", () => {
  const coverage = new Coverage();
  coverage.add(0, 30);
  coverage.add(70, 100);
  assert.deepEqual(coverage.next(200, [[50, 90]], 30), [50, 70]);
  assert.deepEqual(coverage.next(200, [[150, 160], [40, 45]], 30), [150, 180]);
  // Once the selection is done, the sweep carries on from the first gap.
  coverage.add(50, 70);
  assert.deepEqual(coverage.next(200, [[50, 90]], 30), [30, 50]);
});

test("a stretch ends after its last full sentence, so the next one starts on a fresh one", () => {
  const words = [
    { text: "Hello", start: 1, end: 1.4 },
    { text: "there.", start: 1.5, end: 2 },
    { text: "Shipping", start: 80, end: 80.5 },
    { text: "matters.", start: 80.6, end: 81 },
    { text: "And", start: 110, end: 110.3 },
    { text: "then", start: 110.4, end: 110.8 },
  ];
  assert.equal(cutPoint(words, [0, 120], true), 81);
});

test("with no sentence end late in it, a stretch ends in its longest late pause, or else at its own end", () => {
  const words = [
    { text: "one", start: 85, end: 86 },
    { text: "two", start: 90, end: 91 },
    { text: "three", start: 91.2, end: 92 },
    { text: "four", start: 118, end: 119.5 },
  ];
  assert.equal(cutPoint(words, [0, 120], true), 105);
  assert.equal(cutPoint([], [0, 120], true), 120);
  // A stretch that runs into transcribed audio, or to the end of the recording, keeps its end.
  assert.equal(cutPoint(words, [0, 120], false), 120);
});

test("a stretch for the selection starts a little before it, so its first sentence is heard whole", () => {
  const coverage = new Coverage();
  coverage.add(0, 30);
  assert.deepEqual(coverage.next(200, [[50, 90]], 30, 10), [40, 70]);
  // Never back into audio already transcribed, nor before the start.
  assert.deepEqual(coverage.next(200, [[35, 90]], 30, 10), [30, 60]);
  assert.deepEqual(new Coverage().next(200, [[5, 20]], 30, 10), [0, 30]);
});
