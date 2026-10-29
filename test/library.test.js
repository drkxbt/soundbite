import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathData, svgToArt, Unsupported } from "../scripts/svg-paths.js";

const art = (body, box = "0 0 24 24") => svgToArt(`<svg viewBox="${box}">${body}</svg>`);
const reason = (body) => {
  try {
    art(body);
  } catch (error) {
    if (error instanceof Unsupported) return error.reason;
    throw error;
  }
  return null;
};

test("a circle becomes two half arcs, black when nothing says otherwise", () => {
  assert.deepEqual(art('<circle cx="12" cy="12" r="10"/>'), {
    w: 24,
    h: 24,
    paths: [{ d: "M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0z", fill: "#000" }],
  });
});

test("a rect with one corner radius rounds every corner both ways", () => {
  const [path] = art('<rect x="2" y="4" width="20" height="16" rx="3" fill="#2196f3"/>').paths;
  assert.equal(path.d, "M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-14a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3z");
  assert.equal(path.fill, "#2196f3");
});

test("a polyline is open and a polygon is closed, each keeping the stroke it inherits", () => {
  const { paths } = art('<g fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 12 9 17 20 6"/><polygon points="1,1 5,1 3,4"/></g>');
  assert.deepEqual(paths, [
    { d: "M4 12 9 17 20 6", stroke: "currentColor", width: 2 },
    { d: "M1 1 5 1 3 4z", stroke: "currentColor", width: 2 },
  ]);
});

test("a group's translate and scale move the shapes inside it, and its scale thickens their strokes", () => {
  const [path] = art('<g transform="translate(10 4) scale(2)"><line x1="0" y1="0" x2="3" y2="0" stroke="#000"/></g>').paths;
  assert.deepEqual(path, { d: "M10 4 16 4", stroke: "#000", width: 2 });
});

test("evenodd is kept only where the source asks for it", () => {
  const [hole, plain] = art('<path fill-rule="evenodd" d="M0 0h10v10H0zm2 2h6v6H2z"/><path d="M0 0h1v1z"/>').paths;
  assert.equal(hole.rule, "evenodd");
  assert.equal(plain.rule, undefined);
});

test("opacity is folded into the colour, but currentColor can't carry it", () => {
  assert.equal(art('<g opacity=".5"><path fill="#fff" fill-opacity=".5" d="M0 0h1v1z"/></g>').paths[0].fill, "rgba(255,255,255,0.25)");
  assert.equal(reason('<path opacity=".5" fill="currentColor" d="M0 0h1v1z"/>'), "opacity");
});

test("gradients, masks, clip paths, filters and <use> are refused by name", () => {
  assert.equal(reason('<defs><linearGradient id="a"/></defs><path fill="url(#a)" d="M0 0h1v1z"/>'), "gradient");
  assert.equal(reason('<path mask="url(#m)" d="M0 0h1v1z"/>'), "mask");
  assert.equal(reason('<g clip-path="url(#c)"><path d="M0 0h1v1z"/></g>'), "clip path");
  assert.equal(reason('<path filter="url(#f)" d="M0 0h1v1z"/>'), "filter");
  assert.equal(reason('<use href="#a"/>'), "use");
});

test("a turned ellipse keeps its shape, and a stroke stretched one way only is refused", () => {
  const [path] = art('<ellipse cx="10" cy="10" rx="4" ry="2" transform="rotate(90 10 10)"/>').paths;
  assert.equal(path.d, "M10 6a4 2 90 1 0 0 8 4 2 90 1 0 0-8z");
  assert.equal(reason('<path transform="scale(2 1)" stroke="#000" d="M0 0h1"/>'), "transform");
});

test("the viewBox gives the size, and its corner moves to the origin", () => {
  const drawing = art('<path d="M10 10h4v4h-4z"/>', "10 10 48 32");
  assert.equal(drawing.w, 48);
  assert.equal(drawing.h, 32);
  assert.equal(drawing.paths[0].d, "M0 0h4v4h-4z");
});

test("path data is rounded to two places without the error adding up along relative steps", () => {
  assert.equal(pathData("m.333.333.333.333.333.333"), "m.33.33.34.34.33.33");
  assert.equal(pathData("M1.234 5.678a1 1 0 011 1"), "M1.23 5.68a1 1 0 0 1 1 1");
});

const BUILT = ["graphics.json", "stickers.json"].map((file) => new URL(`../dist/app/library/${file}`, import.meta.url));

test("every built drawing has paths, each starting with a move", { skip: !BUILT.every(existsSync) && "run npm run build first" }, () => {
  for (const url of BUILT) {
    const { sets, items } = JSON.parse(readFileSync(url, "utf8"));
    const ids = new Set(sets.map((set) => set.id));
    assert.ok(items.length > 0, url.pathname);
    for (const item of items) {
      assert.ok(ids.has(item.set), item.id);
      assert.ok(item.art.w > 0 && item.art.h > 0, item.id);
      assert.ok(item.art.paths.length > 0, item.id);
      for (const path of item.art.paths) assert.match(path.d, /^[Mm]/, item.id);
    }
  }
});
