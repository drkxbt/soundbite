import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKit } from "../dist/kit.js";
import { PODCAST_TEMPLATES } from "../dist/templates.js";

const LAYOUTS = ["square", "portrait", "story", "landscape"];
const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1920, 1080] };
const THEME_PAINTS = new Set(["text", "muted", "accent", "onAccent", "background"]);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLOUR_FIELDS = ["color", "highlight", "fill", "stroke", "outline", "background", "effectColor"];
const FONTS = new Set([
  "Inter Variable", "Montserrat Variable", "Poppins", "DM Sans Variable", "Outfit Variable", "Space Grotesk Variable",
  "Bricolage Grotesque Variable", "Raleway Variable", "League Spartan Variable", "Archivo Variable", "Nunito Variable",
  "Fredoka Variable", "Syne Variable", "Oswald Variable", "Anton", "Bebas Neue", "Archivo Black", "Unbounded Variable",
  "Alfa Slab One", "Righteous", "Bungee", "Shrikhand", "Luckiest Guy", "Black Ops One", "Monoton", "Press Start 2P",
  "Playfair Display Variable", "DM Serif Display", "Abril Fatface", "Bodoni Moda Variable", "Instrument Serif",
  "Cormorant Garamond Variable", "Libre Baskerville", "Cinzel Variable", "Roboto Slab Variable", "Dancing Script Variable",
  "Pacifico", "Caveat Variable", "Permanent Marker", "Lobster", "Great Vibes", "Satisfy", "Kalam", "Shantell Sans Variable",
  "JetBrains Mono Variable", "Space Mono", "Courier Prime",
]);

const every = (check) => {
  for (const choice of PODCAST_TEMPLATES) for (const layout of LAYOUTS) check(choice.make(layout).layers, `${choice.id} ${layout}`, layout);
};

/** A layer's corners on the frame, in pixels, turned about its centre as the painter turns it. */
function corners(layer, width, height) {
  const cx = (layer.x + layer.w / 2) * width;
  const cy = (layer.y + layer.h / 2) * height;
  const angle = ((layer.rotation ?? 0) * Math.PI) / 180;
  const halfW = (layer.w * width) / 2;
  const halfH = (layer.h * height) / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [
    cx + sx * halfW * Math.cos(angle) - sy * halfH * Math.sin(angle),
    cy + sx * halfW * Math.sin(angle) + sy * halfH * Math.cos(angle),
  ]);
}

test("there are twenty templates, each with its own id and name", () => {
  assert.equal(PODCAST_TEMPLATES.length, 20);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.id)).size, 20);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.name)).size, 20);
  for (const { id, name } of PODCAST_TEMPLATES) {
    assert.match(id, /^[a-z]+(?:-[a-z]+)*$/, id);
    assert.match(name, /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/, name);
  }
});

test("every layer stays inside the frame, turned or not, on every shape", () => {
  every((layers, where, layout) => {
    const [width, height] = SIZES[layout];
    for (const layer of layers) {
      assert.ok(layer.w > 0 && layer.h > 0, `${where}: ${layer.id} has no size`);
      for (const [x, y] of corners(layer, width, height)) {
        assert.ok(x >= -0.5 && x <= width + 0.5 && y >= -0.5 && y <= height + 0.5, `${where}: ${layer.id} leaves the frame at ${Math.round(x)}, ${Math.round(y)}`);
      }
    }
  });
});

test("ids are unique within a template, each the layer's kind and a short name", () => {
  every((layers, where) => {
    assert.equal(new Set(layers.map((layer) => layer.id)).size, layers.length, `${where}: repeated id`);
    for (const layer of layers) assert.ok(layer.id.startsWith(`${layer.kind}-`), `${where}: ${layer.id}`);
  });
});

test("each template has one captions layer and at least one sound visual", () => {
  every((layers, where) => {
    assert.equal(layers.filter((layer) => layer.kind === "captions").length, 1, where);
    assert.ok(layers.some((layer) => layer.kind === "visual"), where);
  });
});

test("every photo frame has a mask, so a picture is cut to its frame instead of spilling past it", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.kind === "image") assert.ok(layer.mask, `${where}: ${layer.id}`);
  });
});

test("every font is one Soundbite ships", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.font !== undefined) assert.ok(FONTS.has(layer.font), `${where}: ${layer.id} uses ${layer.font}`);
  });
});

test("every colour is a hex colour or one of the theme's", () => {
  every((layers, where) => {
    for (const layer of layers) {
      for (const field of COLOUR_FIELDS) {
        const paint = layer[field];
        if (paint !== undefined) assert.ok(HEX.test(paint) || THEME_PAINTS.has(paint), `${where}: ${layer.id} ${field} is ${paint}`);
      }
    }
  });
});

test("a template's page is a colour or a gradient of two, and its theme is one of the five", () => {
  for (const choice of PODCAST_TEMPLATES) {
    for (const layout of LAYOUTS) {
      const { page, theme } = choice.make(layout);
      assert.match(page.color, HEX, choice.id);
      if (page.to !== undefined) assert.match(page.to, HEX, choice.id);
      assert.ok(Number.isInteger(theme) && theme >= 0 && theme < 5, choice.id);
    }
  }
});

test("each call lays a template out afresh, so editing one copy leaves the next alone", () => {
  const [choice] = PODCAST_TEMPLATES;
  const first = choice.make("square");
  first.layers[0].x = 0.5;
  first.page.color = "#000000";
  const second = choice.make("square");
  assert.notEqual(second.layers[0].x, 0.5);
  assert.notEqual(second.page.color, "#000000");
});

test("a template the user saved reads back from their kit unchanged", () => {
  every((layers, where, layout) => {
    const kept = parseKit(JSON.stringify({ layers: { [layout]: layers } })).layers?.[layout];
    assert.deepEqual(kept, JSON.parse(JSON.stringify(layers)), where);
  });
});
