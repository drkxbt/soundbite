import { test } from "node:test";
import assert from "node:assert/strict";
import { METALS, THEMES } from "@drkxbt/audiogram";
import { FONTS as SHIPPED } from "../dist/fonts.js";
import { parseKit } from "../dist/kit.js";
import { PODCAST_TEMPLATES } from "../dist/templates.js";

const LAYOUTS = ["square", "portrait", "story", "landscape"];
const SIZES = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920], landscape: [1920, 1080] };
const THEME_PAINTS = new Set(["text", "muted", "accent", "onAccent", "background"]);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLOUR_FIELDS = ["color", "highlight", "fill", "stroke", "outline", "background", "effectColor"];
// The family names the canvas knows the shipped fonts by: a variable font's carries "Variable".
const FONTS = new Set(SHIPPED.map((font) => (font.variable ? `${font.name} Variable` : font.name)));
// The most a saved kit keeps of one drawing, as kit.ts counts it.
const MOST_PATHS = 64;
const MOST_PATH_DATA = 60_000;

const every = (check) => {
  for (const choice of PODCAST_TEMPLATES) for (const layout of LAYOUTS) check(choice.make(layout).layers, `${choice.id} ${layout}`, layout, choice.make(layout));
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

/** A #rrggbb colour's relative luminance, as WCAG works out contrast. */
function luminance(hex) {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
  const value = parseInt(full.slice(1), 16);
  const channel = (shift) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** The colour halfway down a page's gradient, or its one colour. */
function middleOf(page) {
  if (!page.to) return page.color;
  const mix = (shift) => Math.round(((parseInt(page.color.slice(1), 16) >> shift) & 255) / 2 + ((parseInt(page.to.slice(1), 16) >> shift) & 255) / 2);
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, "0")).join("")}`;
}

test("there are twenty templates, each with its own id and name", () => {
  assert.equal(PODCAST_TEMPLATES.length, 20);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.id)).size, 20);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.name)).size, 20);
  for (const { id, name } of PODCAST_TEMPLATES) {
    assert.match(id, /^[a-z]+(?:-[a-z]+)*$/, id);
    assert.match(name, /^[A-Z][a-z]+(?: (?:[A-Z][a-z]+|and|of)){0,2}$/, name);
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

test("each template has one captions layer, a sound visual, and the speaker's photo, name and the clip's title", () => {
  every((layers, where) => {
    assert.equal(layers.filter((layer) => layer.kind === "captions").length, 1, where);
    for (const kind of ["visual", "avatar", "name", "title"]) assert.ok(layers.some((layer) => layer.kind === kind), `${where}: no ${kind}`);
  });
});

test("the captions sit in the frame's middle band, and their words are large enough to read on a phone", () => {
  every((layers, where) => {
    const words = layers.find((layer) => layer.kind === "captions");
    assert.ok(words.size >= 46, `${where}: captions at ${words.size}`);
    assert.ok(words.y > 0.1 && words.y + words.h < 0.95, `${where}: captions at ${words.y.toFixed(2)}`);
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

test("every colour is a hex colour, one of the theme's, or a metal", () => {
  every((layers, where) => {
    for (const layer of layers) {
      for (const field of COLOUR_FIELDS) {
        const paint = layer[field];
        if (paint !== undefined) assert.ok(HEX.test(paint) || THEME_PAINTS.has(paint) || paint in METALS, `${where}: ${layer.id} ${field} is ${paint}`);
      }
    }
  });
});

test("the word being said is marked in a flat colour, since the word on it takes black or white by its lightness", () => {
  every((layers, where) => {
    const { highlight } = layers.find((layer) => layer.kind === "captions");
    assert.ok(highlight !== undefined && !(highlight in METALS), `${where}: highlight is ${highlight}`);
    // The painter's own choice of ink: black on a light highlight, white on a dark one.
    const ink = luminance(highlight) > 0.4 ? "#111111" : "#ffffff";
    assert.ok(contrast(ink, highlight) >= 4.5, `${where}: the word on ${highlight} reads at ${contrast(ink, highlight).toFixed(2)}`);
  });
});

test("every label of plain words hugs them, so it moves by what shows of it", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.kind === "text") assert.equal(layer.autoWidth, true, `${where}: ${layer.id}`);
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

test("the words of a caption not yet said, drawn in the theme's muted colour, read on the page", () => {
  for (const choice of PODCAST_TEMPLATES) {
    const { page, theme } = choice.make("portrait");
    const ratio = contrast(THEMES[theme].muted, middleOf(page));
    assert.ok(ratio >= 3, `${choice.id}: ${ratio.toFixed(2)}`);
  }
});

test("no shape covers most of the page, so the page's own colour stays the ground", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.kind === "shape" && layer.shape !== "line") assert.ok(layer.w * layer.h < 0.5, `${where}: ${layer.id} covers ${Math.round(layer.w * layer.h * 100)}%`);
  });
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

test("every drawing fits what a saved kit keeps of one, and reads back from it whole", () => {
  every((layers, where, layout) => {
    for (const layer of layers) {
      if (layer.kind !== "graphic") continue;
      const { paths } = layer.art;
      assert.ok(paths.length <= MOST_PATHS, `${where}: ${layer.id} has ${paths.length} paths`);
      const data = paths.reduce((sum, path) => sum + path.d.length, 0);
      assert.ok(data <= MOST_PATH_DATA, `${where}: ${layer.id} has ${data} characters of path data`);
      const kept = parseKit(JSON.stringify({ layers: { [layout]: [layer] } })).layers?.[layout]?.[0];
      assert.deepEqual(kept?.art, layer.art, `${where}: ${layer.id} is not kept whole`);
    }
  });
});

test("a template the user saved reads back from their kit unchanged", () => {
  every((layers, where, layout) => {
    const kept = parseKit(JSON.stringify({ layers: { [layout]: layers } })).layers?.[layout];
    assert.deepEqual(kept, JSON.parse(JSON.stringify(layers)), where);
  });
});
