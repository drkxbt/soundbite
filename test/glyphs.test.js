import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLYPH_NAMES, glyphs, glyphsSource } from "../scripts/glyphs.js";
import { parseKit } from "../dist/kit.js";

// kit.ts drops a saved path that fails these, so a glyph that failed them would vanish from a design on reload.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;

test("glyphs.ts is what scripts/glyphs.js writes from the installed icon set", async () => {
  // Git may check the file out with Windows line ends.
  const file = readFileSync(new URL("../glyphs.ts", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  assert.equal(file, await glyphsSource(), "run `node scripts/glyphs.js` to regenerate glyphs.ts");
});

test("every listed glyph is there once, in order, as one path in the layer's colour", async () => {
  const art = await glyphs();
  assert.deepEqual(Object.keys(art), GLYPH_NAMES);
  assert.equal(new Set(GLYPH_NAMES).size, GLYPH_NAMES.length);
  for (const [name, glyph] of Object.entries(art)) {
    assert.deepEqual([glyph.w, glyph.h], [256, 256], name);
    assert.ok(glyph.paths.length > 0, name);
    for (const part of glyph.paths) {
      assert.match(part.d, PATH, name);
      assert.match(part.d, /^[Mm]/, name);
      assert.ok(part.d.length <= 20000, name);
      assert.equal(part.fill, "currentColor", name);
    }
  }
});

test("a design keeps every glyph unchanged through a save and a reload", async () => {
  const layers = Object.entries(await glyphs()).map(([name, art]) => ({
    id: name, kind: "graphic", art, x: 0.1, y: 0.1, w: 0.1, h: 0.1, rotation: 0, opacity: 1,
  }));
  const saved = parseKit(JSON.stringify({ layers: { square: layers } })).layers.square;
  assert.deepEqual(saved.map((layer) => layer.art), layers.map((layer) => layer.art));
});
