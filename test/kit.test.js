import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKit } from "../dist/kit.js";

test("nothing saved, or something unreadable, is an empty kit", () => {
  assert.deepEqual(parseKit(null), {});
  assert.deepEqual(parseKit("{not json"), {});
  assert.deepEqual(parseKit("[1,2]"), {});
  assert.deepEqual(parseKit('"text"'), {});
});

test("fields of the wrong kind are dropped, the rest kept", () => {
  assert.deepEqual(parseKit(JSON.stringify({ layout: "wide", theme: "2" })), {});
  assert.deepEqual(parseKit(JSON.stringify({ visual: "sparkles", theme: -1, cover: "https://example.com/a.png", title: 5 })), {});
  assert.deepEqual(parseKit(JSON.stringify({ speaker: "drk", theme: 1.5 })), { speaker: "drk" });
});

test("a kit saved by Soundbite reads back the same", () => {
  const kit = { title: "Shipping in public", speaker: "drk", handle: "@drkxbt", layout: "portrait", visual: "wave", theme: 2, cover: "data:image/jpeg;base64,/9j/4AAQ" };
  assert.deepEqual(parseKit(JSON.stringify(kit)), kit);
});

test("a background picture is kept as a picture, and nothing else in its place", () => {
  const kit = { speaker: "drk", background: "data:image/jpeg;base64,/9j/4AAQ" };
  assert.deepEqual(parseKit(JSON.stringify(kit)), kit);
  assert.deepEqual(parseKit(JSON.stringify({ background: "https://example.com/a.jpg" })), {});
});

test("a logo kept by an older Soundbite is left behind, since clips no longer carry one", () => {
  assert.deepEqual(parseKit(JSON.stringify({ speaker: "drk", logo: "data:image/png;base64,iVBORw0KGgo=" })), { speaker: "drk" });
});

test("up to three links are kept as text, anything else in their place dropped", () => {
  assert.deepEqual(parseKit(JSON.stringify({ links: ["drk.vc", "x.com/drkxbt"] })), { links: ["drk.vc", "x.com/drkxbt"] });
  assert.deepEqual(parseKit(JSON.stringify({ links: ["a.com", 5, "b.com", "c.com", "d.com"] })), { links: ["a.com", "b.com", "c.com"] });
  assert.deepEqual(parseKit(JSON.stringify({ links: "drk.vc" })), {});
  assert.deepEqual(parseKit(JSON.stringify({ links: ["x".repeat(200)] })), {});
});

test("the music's level is kept, the music itself is not", () => {
  assert.deepEqual(parseKit(JSON.stringify({ musicVolume: 0.4, music: "data:audio/mpeg;base64,AAAA" })), { musicVolume: 0.4 });
  assert.deepEqual(parseKit(JSON.stringify({ musicVolume: 3 })), {});
  assert.deepEqual(parseKit(JSON.stringify({ musicVolume: "0.4" })), {});
});

test("every shape the editor offers is kept, the 9:16 story among them", () => {
  for (const layout of ["square", "portrait", "story", "landscape"]) assert.deepEqual(parseKit(JSON.stringify({ layout })), { layout });
});

test("a layout the user made is kept per shape, each layer checked field by field", () => {
  const good = { id: "text-1", kind: "text", text: "Big news", x: 0.1, y: 0.4, w: 0.8, h: 0.1, rotation: 15, opacity: 0.8, font: "Anton", size: 96, weight: 800, color: "#ff3366", align: "center" };
  const kit = parseKit(JSON.stringify({ layers: { square: [good, { id: "x", kind: "rocket", x: 0, y: 0, w: 1, h: 1 }], cube: [good], story: "nope" } }));
  assert.deepEqual(Object.keys(kit.layers), ["square"]);
  assert.deepEqual(kit.layers.square, [good]);
});

test("a layer with numbers that aren't numbers, or out of their range, is dropped or held in range", () => {
  const base = { id: "a", kind: "shape", x: 0, y: 0, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  const kit = parseKit(JSON.stringify({ layers: { square: [{ ...base, x: "0.5" }, { ...base, id: "b", w: -1 }, { ...base, id: "c", opacity: 7, size: 9000, text: "x".repeat(5000) }] } }));
  assert.equal(kit.layers.square.length, 1);
  const [kept] = kit.layers.square;
  assert.equal(kept.id, "c");
  assert.equal(kept.opacity, 1);
  assert.equal(kept.size, 400);
  assert.equal(kept.text.length, 2000);
});
