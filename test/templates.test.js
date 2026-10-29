import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTERS, THEMES } from "@drkxbt/audiogram";
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
// The bundled library a template's "photo:" pictures come from.
const PHOTOS = new Set(JSON.parse(readFileSync(new URL("../photos/photos.json", import.meta.url), "utf8")).map((photo) => photo.id));
// The longest page of captions the editor shows at once on each shape, in characters, as Audiogram's editor splits them.
const PAGE = { square: 32, portrait: 34, story: 32, landscape: 46 };
// A long episode title, in characters: "Why we shipped the whole roadmap in public" and a clause more.
const LONG_TITLE = 60;
// The kinds of layer that are words, and the ones among them that are only ornament, which may be larger and fainter.
const WORDS = new Set(["title", "name", "handle", "time", "text", "links"]);
const ORNAMENTS = new Set(["text-quote"]);

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

/** Whether box `inner` lies inside box `outer`, both in fractions of the frame. */
const within = (inner, outer) => inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 && inner.x + inner.w <= outer.x + outer.w + 1e-6 && inner.y + inner.h <= outer.y + outer.h + 1e-6;

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

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

test("there are sixteen templates, each with its own id and a short name of one to three words", () => {
  assert.equal(PODCAST_TEMPLATES.length, 16);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.id)).size, 16);
  assert.equal(new Set(PODCAST_TEMPLATES.map((choice) => choice.name)).size, 16);
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

test("the captions sit clear of the apps' bands, in words large enough to read on a phone", () => {
  every((layers, where) => {
    const words = layers.find((layer) => layer.kind === "captions");
    assert.ok(words.size >= 46, `${where}: captions at ${words.size}`);
    assert.ok(words.y > 0.1 && words.y + words.h < 0.95, `${where}: captions at ${words.y.toFixed(2)}`);
  });
});

test("the longest page of captions the editor shows fits the captions box without losing a line", () => {
  every((layers, where, layout) => {
    const [width, height] = SIZES[layout];
    const unit = Math.min(width, height) / 1080;
    const words = layers.find((layer) => layer.kind === "captions");
    const size = words.size * unit;
    const room = Math.floor((words.h * height) / (size * (words.lineHeight ?? 1.34)));
    // An average letter is a little over half the size wide; 0.6 leaves room for wide faces and for wrapping.
    const needed = Math.ceil((PAGE[layout] * 0.6 * size) / (words.w * width));
    assert.ok(room >= needed, `${where}: room for ${room} lines, a page needs ${needed}`);
  });
});

test("the title's box holds every line a sixty-character title needs, on every shape", () => {
  every((layers, where, layout) => {
    const [width, height] = SIZES[layout];
    const unit = Math.min(width, height) / 1080;
    const title = layers.find((layer) => layer.kind === "title");
    const size = (title.size ?? 40) * unit;
    // The lines the painter keeps of a title, as it counts them from the box's height.
    const room = Math.max(1, Math.floor((title.h * height) / (size * (title.lineHeight ?? 1.15)) + 0.05));
    // The widest title face here averages 0.51 of its size a letter; 0.56 leaves room for where the lines break.
    const needed = Math.ceil((LONG_TITLE * 0.56 * size) / (title.w * width));
    assert.ok(room >= needed, `${where}: room for ${room} lines of title, a long one needs ${needed}`);
  });
});

test("words that carry something are set at 26 or more and at three quarters strength or more, to read in a phone's feed", () => {
  every((layers, where) => {
    for (const layer of layers) {
      if (!WORDS.has(layer.kind) || ORNAMENTS.has(layer.id)) continue;
      assert.ok((layer.size ?? 40) >= 26, `${where}: ${layer.id} at ${layer.size}`);
      assert.ok(layer.opacity >= 0.75, `${where}: ${layer.id} at opacity ${layer.opacity}`);
    }
  });
});

test("captions over a photo have a darker ground made for them: glass tinted against their colour, or the photo graded down", () => {
  // This checks how each template is built, not its pixels, which depend on the photo. The painter draws the words
  // still to come at half strength; rendered, these settings put them near 3:1 on what lies under them.
  let checked = 0;
  every((layers, where) => {
    const index = layers.findIndex((layer) => layer.kind === "captions");
    const words = layers[index];
    const under = layers.slice(0, index);
    const photos = under.filter((layer) => layer.kind === "image" && overlaps(layer, words));
    if (!photos.length) return;
    checked++;
    const light = luminance(words.color) > 0.5;
    const pane = under.findLast((layer) => layer.frost && within(words, layer));
    if (pane) {
      const tint = luminance(pane.fill);
      if (light) assert.ok(tint < 0.02 && pane.opacity >= 0.4, `${where}: light words on ${pane.fill} glass at ${pane.opacity}`);
      else assert.ok(tint > 0.9 && pane.opacity >= 0.5, `${where}: dark words on ${pane.fill} glass at ${pane.opacity}`);
      return;
    }
    assert.ok(light, `${where}: dark words straight on a photo`);
    for (const photo of photos) assert.ok((photo.adjust?.brightness ?? 1) <= 0.62, `${where}: words on ${photo.id} at brightness ${photo.adjust?.brightness ?? 1}`);
  });
  assert.ok(checked > 0);
});

test("every picture frame has a mask, so a picture is cut to its frame instead of spilling past it", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.kind === "image") assert.ok(layer.mask, `${where}: ${layer.id}`);
  });
});

test("every photo a template asks for is one the bundled library has, and a backdrop covers the whole frame", () => {
  let asked = 0;
  every((layers, where) => {
    for (const layer of layers) {
      if (!layer.image?.startsWith("photo:")) continue;
      asked++;
      assert.ok(PHOTOS.has(layer.image.slice("photo:".length)), `${where}: ${layer.image} is not in photos.json`);
      if (layer.backdrop) assert.deepEqual([layer.x, layer.y, layer.w, layer.h], [0, 0, 1, 1], `${where}: ${layer.id}`);
    }
  });
  assert.ok(asked > 0);
});

test("a photo's filter is one Audiogram paints", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.filter !== undefined) assert.ok(layer.filter in FILTERS, `${where}: ${layer.id} filter ${layer.filter}`);
  });
});

test("frosted glass is only on shapes that have an outline to fill, and within the blur the painter allows", () => {
  let glass = 0;
  every((layers, where) => {
    for (const layer of layers) {
      if (layer.frost === undefined) continue;
      glass++;
      assert.equal(layer.kind, "shape", `${where}: ${layer.id}`);
      assert.notEqual(layer.shape, "line", `${where}: ${layer.id}`);
      assert.ok(layer.frost > 0 && layer.frost <= 60, `${where}: ${layer.id} frost ${layer.frost}`);
      assert.ok(layer.fill !== undefined, `${where}: ${layer.id} has no tint`);
    }
  });
  assert.ok(glass > 0);
});

test("a shape that covers most of the page is see-through glass, so the photo or page under it still shows", () => {
  every((layers, where) => {
    for (const layer of layers) {
      if (layer.kind !== "shape" || layer.shape === "line" || layer.w * layer.h < 0.5) continue;
      assert.ok(layer.frost > 0 && layer.opacity <= 0.5, `${where}: ${layer.id} covers ${Math.round(layer.w * layer.h * 100)}% and is solid`);
    }
  });
});

test("the sound styles and clock formats the templates use are ones a saved kit keeps", () => {
  const kept = { visual: new Set(), clock: new Set() };
  every((layers, where, layout) => {
    const back = parseKit(JSON.stringify({ layers: { [layout]: layers } })).layers[layout];
    for (const [index, layer] of layers.entries()) {
      for (const field of ["visual", "clock", "frost", "filter", "image", "shadow"]) {
        if (layer[field] !== undefined) assert.deepEqual(back[index]?.[field], layer[field], `${where}: ${layer.id} loses its ${field}`);
      }
      if (layer.visual) kept.visual.add(layer.visual);
      if (layer.clock) kept.clock.add(layer.clock);
    }
  });
  // The set shows the ring of dots and every way of telling the time but the default.
  assert.ok(kept.visual.has("ring") && kept.visual.has("bars"));
  assert.deepEqual([...kept.clock].sort(), ["elapsed", "percent", "remaining"]);
});

test("every font is one Soundbite ships", () => {
  every((layers, where) => {
    for (const layer of layers) if (layer.font !== undefined) assert.ok(FONTS.has(layer.font), `${where}: ${layer.id} uses ${layer.font}`);
  });
});

test("every colour is a hex colour or one of the theme's, and none is a metal finish", () => {
  every((layers, where) => {
    for (const layer of layers) {
      for (const field of COLOUR_FIELDS) {
        const paint = layer[field];
        if (paint !== undefined) assert.ok(HEX.test(paint) || THEME_PAINTS.has(paint), `${where}: ${layer.id} ${field} is ${paint}`);
      }
    }
  });
});

test("the word being said reads on its highlight, in the black or white the painter picks for it", () => {
  every((layers, where) => {
    const { highlight } = layers.find((layer) => layer.kind === "captions");
    // The painter picks the ink only for a six-digit colour; anything else gets black.
    assert.match(highlight, /^#[0-9a-f]{6}$/i, where);
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

test("words the user adds later, in the theme's colours, read on the page while its photo is still coming", () => {
  for (const choice of PODCAST_TEMPLATES) {
    const { page, theme } = choice.make("portrait");
    const ground = middleOf(page);
    assert.ok(contrast(THEMES[theme].text, ground) >= 4.5, `${choice.id}: text at ${contrast(THEMES[theme].text, ground).toFixed(2)}`);
    assert.ok(contrast(THEMES[theme].muted, ground) >= 3, `${choice.id}: muted at ${contrast(THEMES[theme].muted, ground).toFixed(2)}`);
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
