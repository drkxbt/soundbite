import { test } from "node:test";
import assert from "node:assert/strict";
import { credit } from "../dist/credit.js";
import { watchAd } from "../dist/ads.js";

// A 2D context that keeps what was written and the shapes drawn, measures text at half its size a letter, and
// accepts everything else.
function recordingContext() {
  const texts = [];
  const shapes = [];
  const state = { textAlign: "start", textBaseline: "alphabetic", fillStyle: "#000", font: "", globalAlpha: 1 };
  const size = () => Number(state.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
  const calls = {
    fillText: (text, x, y) => texts.push({ text, x, y, align: state.textAlign, font: state.font, fill: state.fillStyle }),
    fill: () => shapes.length && (shapes[shapes.length - 1].fill ??= state.fillStyle),
    measureText: (text) => ({ width: text.length * size() * 0.5 }),
    roundRect: (x, y, width, height, radius) => shapes.push({ x, y, width, height, radius }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => calls[key] ?? (key in target ? target[key] : () => {}),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, texts, shapes };
}

const theme = { name: "Night", background: "#000", shade: "#111", text: "#fff", muted: "#999", accent: "#0f0", onAccent: "#000" };
const frame = (time, width = 1080, height = 1350) => ({ time, duration: 30, width, height, unit: Math.min(width, height) / 1080, theme, font: "Geist" });

test("the credit is on every frame, from the first to the last", () => {
  for (const time of [0, 15, 30]) {
    const { ctx, texts } = recordingContext();
    credit(ctx, frame(time));
    assert.equal(texts.map((item) => item.text).join(" "), "made with drk.vc/engines/soundbite");
  }
});

test("the credit is a small label in the top right corner, inside the margin above everything else", () => {
  for (const [width, height] of [[1080, 1080], [1080, 1350], [1920, 1080]]) {
    const { ctx, texts, shapes } = recordingContext();
    credit(ctx, frame(5, width, height));
    const pad = Math.round(Math.min(width, height) * 0.074);
    assert.equal(shapes.length, 1, "one label behind the words");
    const [label] = shapes;
    assert.ok(Math.abs(label.x + label.width - (width - pad)) < 0.5, `label ends at the margin, ${label.x + label.width} vs ${width - pad}`);
    assert.ok(label.y > 0 && label.y + label.height < pad, `label ${label.y}..${label.y + label.height} inside the top margin of ${pad}`);
    assert.ok(label.radius <= 10 * (Math.min(width, height) / 1080), `corner ${label.radius}`);
    for (const item of texts) {
      assert.ok(item.x >= label.x && item.x < label.x + label.width, `"${item.text}" starts inside the label`);
      assert.ok(Number(item.font.match(/(\d+)px/)[1]) <= 26, item.font);
    }
  }
});

test("with no ad unit set up, a crowned size needs no ad", async () => {
  assert.equal(await watchAd(""), "granted");
});

test("an ad tag that never loads gives up instead of waiting for ever", async () => {
  // A page where Google's tag is requested but neither loads nor fails, as some blockers leave it.
  globalThis.window = {};
  globalThis.document = { createElement: () => ({ addEventListener() {}, remove() {} }), head: { append() {} } };
  try {
    const started = Date.now();
    assert.equal(await watchAd("/1/test", { timeout: 60 }), "unavailable");
    assert.ok(Date.now() - started < 1000);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test("the credit reads on any page: its own dark label and light words, whatever the theme and the picture behind", () => {
  const paper = { name: "Paper", background: "#f5f4f0", shade: "#e6e3da", text: "#121212", muted: "#6a6b6f", accent: "#121212", onAccent: "#f5f4f0" };
  const looks = [theme, paper].map((each) => {
    const { ctx, texts, shapes } = recordingContext();
    credit(ctx, { ...frame(1), theme: each });
    return { label: shapes[0].fill, words: texts.map((item) => item.fill) };
  });
  assert.deepEqual(looks[0], looks[1], "the same colours under a dark and a light theme");
  assert.match(looks[0].label, /^rgba\(1[0-9], 1[0-9], 1[0-9], 0\.[6-9]/, "a dark label");
  assert.ok(looks[0].words.every((fill) => /^#f|^rgba\(255/.test(fill)), `light words, ${looks[0].words}`);
});
