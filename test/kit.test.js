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

test("a layer's look, its flips and tone, its way in and its times are kept, each checked", () => {
  const good = {
    id: "v-1", kind: "video", image: "picture-1", x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1,
    flipX: true, adjust: { brightness: 1.2, contrast: 0.9, saturation: 0, blur: 4 }, enter: "pop", from: 2.5, until: 9,
  };
  const words = { id: "t", kind: "text", text: "Hi", x: 0.1, y: 0.1, w: 0.5, h: 0.1, rotation: 0, opacity: 1, shadow: true, outline: "#000000", background: "#ffd84d", uppercase: true, enter: "typewriter" };
  const sound = { id: "s", kind: "visual", visual: "pulse", x: 0.1, y: 0.5, w: 0.8, h: 0.2, rotation: 0, opacity: 1 };
  const star = { id: "st", kind: "shape", shape: "star", fill: "#ff0000", x: 0.3, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  assert.deepEqual(parseKit(JSON.stringify({ layers: { square: [good, words, sound, star] } })).layers.square, [good, words, sound, star]);
  const bad = parseKit(JSON.stringify({ layers: { square: [{ ...good, enter: "explode", from: -3, until: "soon", adjust: { brightness: 9, blur: "x" }, visual: "lasers", shape: "blob", flipY: "yes" }] } })).layers.square[0];
  assert.equal(bad.enter, undefined);
  assert.equal(bad.from, 0);
  assert.equal(bad.until, undefined);
  assert.deepEqual(bad.adjust, { brightness: 2 });
  assert.equal(bad.visual, undefined);
  assert.equal(bad.shape, undefined);
  assert.equal(bad.flipY, undefined);
});

test("the page's colour is kept as colours, a gradient with its angle, or none for the theme's", () => {
  assert.deepEqual(parseKit(JSON.stringify({ page: { color: "#ffffff" } })), { page: { color: "#ffffff" } });
  assert.deepEqual(parseKit(JSON.stringify({ page: { color: "#ff9a8b", to: "#ffd86f", angle: 135 } })), { page: { color: "#ff9a8b", to: "#ffd86f", angle: 135 } });
  assert.deepEqual(parseKit(JSON.stringify({ page: null })), { page: null });
  assert.deepEqual(parseKit(JSON.stringify({ page: { color: "url(javascript:1)" } })), {});
  assert.deepEqual(parseKit(JSON.stringify({ page: { color: "#fff", to: "red", angle: 900 } })), { page: { color: "#fff" } });
});

test("the newer layer fields are kept when sound and dropped when not", () => {
  const art = { w: 24, h: 24, paths: [{ d: "M2 2L22 22", stroke: "currentColor", width: 2 }, { d: "M0 0h4v4z", fill: "#123456", rule: "evenodd" }] };
  const graphic = { id: "g", kind: "graphic", art, color: "#ff0000", group: "group-1", x: 0.1, y: 0.1, w: 0.2, h: 0.2, rotation: 0, opacity: 1, exit: "fade", loop: "pulse", speed: 1.5 };
  const words = { id: "t", kind: "text", text: "Hi", x: 0.1, y: 0.1, w: 0.5, h: 0.1, rotation: 0, opacity: 1, effect: "neon", effectColor: "#00ffaa", underline: true, strike: true, letterSpacing: 120, lineHeight: 1.6, list: "bullet", curve: -40 };
  const shape = { id: "s", kind: "shape", shape: "line", fill: "#111111", stroke: "#222222", strokeWidth: 8, dash: "dashed", arrowStart: true, arrowEnd: true, x: 0.1, y: 0.5, w: 0.5, h: 0.05, rotation: 0, opacity: 1 };
  const photo = { id: "p", kind: "image", image: "photo-1", mask: "heart", crop: { x: 0.2, y: -0.4, zoom: 1.8 }, filter: "mono", x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };
  assert.deepEqual(parseKit(JSON.stringify({ layers: { square: [graphic, words, shape, photo] } })).layers.square, [graphic, words, shape, photo]);
  const bad = parseKit(JSON.stringify({ layers: { square: [
    { ...graphic, art: { w: 24, h: 24, paths: [{ d: "javascript:alert(1)" }] }, loop: "explode", speed: 99 },
    { ...words, effect: "melt", list: "stars", curve: 900, letterSpacing: 99999, lineHeight: 0 },
    { ...photo, mask: "blob", crop: { x: 5, y: "no", zoom: 50 }, filter: "x".repeat(100) },
  ] } })).layers.square;
  assert.equal(bad.length, 2, "a graphic with no drawable paths is dropped");
  const [text, picture] = bad;
  assert.equal(text.effect, undefined);
  assert.equal(text.list, undefined);
  assert.equal(text.curve, 100);
  assert.equal(text.letterSpacing, 800);
  assert.equal(text.lineHeight, 0.5);
  assert.equal(picture.mask, undefined);
  assert.deepEqual(picture.crop, { x: 1, y: 0, zoom: 4 });
  assert.equal(picture.filter, undefined);
});

test("a layer's colours are hex colours or the theme's names, nothing that could load from elsewhere", () => {
  const base = { id: "t", kind: "text", text: "Hi", x: 0.1, y: 0.1, w: 0.5, h: 0.1, rotation: 0, opacity: 1 };
  const [kept] = parseKit(JSON.stringify({ layers: { square: [{ ...base, color: "url(https://evil.example/p.png)", fill: "accent", stroke: "#12345678", highlight: "#fff", background: "red" }] } })).layers.square;
  assert.equal(kept.color, undefined);
  assert.equal(kept.fill, "accent");
  assert.equal(kept.stroke, undefined);
  assert.equal(kept.highlight, "#fff");
  assert.equal(kept.background, undefined);
});

test("a drawing too big to paint every frame is dropped", () => {
  const path = { d: `M0 0${" L1 1".repeat(3000)}`, fill: "#000000" };
  const heavy = { id: "g", kind: "graphic", art: { w: 24, h: 24, paths: Array.from({ length: 100 }, () => path) }, x: 0, y: 0, w: 0.2, h: 0.2, rotation: 0, opacity: 1 };
  assert.deepEqual(parseKit(JSON.stringify({ layers: { square: [heavy] } })).layers.square, []);
});
