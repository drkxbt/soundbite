import { test } from "node:test";
import assert from "node:assert/strict";
import { credit } from "../dist/credit.js";
import { watchAd } from "../dist/ads.js";

// A 2D context that keeps what was written and where, and accepts everything else.
function recordingContext() {
  const texts = [];
  const state = { textAlign: "start", textBaseline: "alphabetic", fillStyle: "#000", font: "", globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get: (target, key) => (key === "fillText" ? (text, x, y) => texts.push({ text, x, y, align: target.textAlign, alpha: target.globalAlpha }) : key in target ? target[key] : () => {}),
    set: (target, key, value) => ((target[key] = value), true),
  });
  return { ctx, texts };
}

const theme = { name: "Night", background: "#000", shade: "#111", text: "#fff", muted: "#999", accent: "#0f0", onAccent: "#000" };
const frame = (time, width = 1080, height = 1350) => ({ time, duration: 30, width, height, unit: Math.min(width, height) / 1080, theme, font: "Geist" });

test("the credit is on every frame, from the first to the last", () => {
  for (const time of [0, 15, 30]) {
    const { ctx, texts } = recordingContext();
    credit(ctx, frame(time));
    assert.equal(texts.length, 1);
    assert.equal(texts[0].text, "made with drk.vc/soundbite");
  }
});

test("the credit sits small in the top right corner, inside the margin above everything else", () => {
  for (const [width, height] of [[1080, 1080], [1080, 1350], [1920, 1080]]) {
    const { ctx, texts } = recordingContext();
    credit(ctx, frame(5, width, height));
    const pad = Math.round(Math.min(width, height) * 0.074);
    assert.equal(texts[0].align, "right");
    assert.equal(texts[0].x, width - pad);
    assert.ok(texts[0].y > 0 && texts[0].y < pad, `y ${texts[0].y} in the top margin of ${pad}`);
    assert.ok(/\b(\d+)px/.test(ctx.font) && Number(ctx.font.match(/(\d+)px/)[1]) <= 26, ctx.font);
  }
});

test("with no ad unit set up, removing the credit needs no ad", async () => {
  assert.equal(await watchAd(""), "granted");
});
