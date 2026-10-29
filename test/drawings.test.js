import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as simpleIcons from "simple-icons";
import { FEATURED, toArt, writeDrawings } from "../scripts/drawings.js";

// kit.ts drops a saved path that fails these, so a drawing that failed them would vanish from a design on reload.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const SETS = ["emoji", "icons", "logos"];

let dir;
let result;
const sets = {};
const read = (file) => JSON.parse(readFileSync(join(dir, file), "utf8"));
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "soundbite-drawings-"));
  result = await writeDrawings(dir);
  for (const id of SETS) sets[id] = read(`${id}.json`);
});
after(() => rm(dir, { recursive: true, force: true }));

const byName = (a, b) => a.name.localeCompare(b.name, "en");

test("each set holds the drawings it reports, each with its own id, a name and paths a saved design keeps", () => {
  for (const id of SETS) {
    const list = sets[id];
    assert.ok(list.length > 1000, `${id}: ${list.length}`);
    assert.equal(result.sets[id].count, list.length, id);
    assert.equal(new Set(list.map((drawing) => drawing.id)).size, list.length, id);
    for (const { id: key, name, art } of list) {
      assert.ok(name, key);
      assert.ok(art.w > 0 && art.h > 0, key);
      assert.ok(art.paths.length > 0 && art.paths.length <= 64, key);
      for (const part of art.paths) {
        assert.match(part.d, PATH, key);
        assert.match(part.d, /^[Mm]/, key);
        assert.ok(part.d.length <= 20000, key);
      }
    }
  }
});

test("each first file is the first eight of its set", () => {
  for (const id of SETS) assert.deepEqual(read(`${id}.first.json`), sets[id].slice(0, 8), id);
});

test("the featured drawings lead each set in order, and every featured icon and emoji is there", () => {
  for (const id of SETS) {
    const featured = FEATURED[id].filter((key) => !result.sets[id].skipped.includes(key));
    assert.deepEqual(sets[id].slice(0, featured.length).map((drawing) => drawing.id), featured, id);
  }
  assert.deepEqual(result.sets.icons.skipped, []);
  assert.deepEqual(result.sets.emoji.skipped, []);
  for (const id of ["x", "youtube", "tiktok", "instagram", "spotify"]) assert.ok(FEATURED.logos.includes(id) && !result.sets.logos.skipped.includes(id), id);
});

test("logos are CC0 single paths in the brand's #rrggbb colour, sorted by name after the featured ones", () => {
  const source = new Map(Object.values(simpleIcons).map((icon) => [icon.slug, icon]));
  const logos = sets.logos;
  for (const logo of logos) {
    const licence = source.get(logo.id).license;
    assert.ok(!licence || licence.type === "CC0-1.0", logo.id);
    assert.deepEqual([logo.art.w, logo.art.h, logo.art.paths.length], [24, 24, 1], logo.id);
    assert.equal(logo.art.paths[0].fill, "currentColor", logo.id);
    assert.match(logo.color, /^#[0-9a-f]{6}$/, logo.id);
  }
  const rest = logos.slice(FEATURED.logos.length - result.sets.logos.skipped.length);
  assert.deepEqual(rest.map((logo) => logo.name), rest.toSorted(byName).map((logo) => logo.name));
  assert.ok(result.sets.logos.dropped.licence > 0);
});

test("icons come in the regular, fill and duotone weights, named and tagged for each", () => {
  const icons = new Map(sets.icons.map((icon) => [icon.id, icon]));
  assert.deepEqual(
    ["heart", "heart-fill", "heart-duotone"].map((id) => [icons.get(id)?.name, icons.get(id)?.tags]),
    [["Heart", undefined], ["Heart, filled", ["fill"]], ["Heart, two-tone", ["duotone"]]],
  );
  for (const id of icons.keys()) assert.doesNotMatch(id, /-(bold|light|thin)$/);
  // The two-tone weight shades its fill: that path keeps its opacity.
  assert.ok(icons.get("heart-duotone").art.paths.some((part) => part.opacity === 0.2));
});

test("emoji keep the default yellow and leave out every skin tone", () => {
  const ids = new Set(sets.emoji.map((drawing) => drawing.id));
  for (const id of ["thumbs-up", "waving-hand", "clapping-hands"]) assert.ok(ids.has(id), id);
  // Only a name that happens to end in a tone's word is left, with no emoji of its own it would be a tone of.
  assert.deepEqual(
    [...ids].filter((id) => /-(light|medium|dark)$/.test(id)).sort(),
    ["horizontal-traffic-light", "vertical-traffic-light"],
  );
  const rest = sets.emoji.slice(FEATURED.emoji.length);
  assert.deepEqual(rest.map((drawing) => drawing.name), rest.toSorted(byName).map((drawing) => drawing.name));
});

test("each set stays small enough to fetch when the panel needs it", () => {
  for (const id of SETS) assert.ok(result.sets[id].bytes.raw < 6_000_000, `${id}: ${result.sets[id].bytes.raw}`);
});

test("the converter draws circles, rounded rects and inherited paint", () => {
  assert.deepEqual(toArt('<circle cx="16" cy="16" r="8" fill="#F00"/>', 32, 32).art, {
    w: 32,
    h: 32,
    paths: [{ d: "M8 16c0 4.42 3.58 8 8 8 4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8-4.42 0-8 3.58-8 8z", fill: "#ff0000" }],
  });
  assert.deepEqual(toArt('<rect x="2" y="4" width="20" height="10" rx="3"/>', 32, 32).art.paths, [
    { d: "M5 4h14c1.66 0 3 1.34 3 3v4c0 1.66-1.34 3-3 3h-14c-1.66 0-3-1.34-3-3v-4c0-1.66 1.34-3 3-3z", fill: "#000000" },
  ]);
  assert.deepEqual(toArt('<g fill="currentColor"><path d="M0 0h4v4z"/><g fill="#abc"><path d="M8 0h4v4z"/></g></g>', 32, 32).art.paths, [
    { d: "M0 0h4v4z", fill: "currentColor" },
    { d: "M8 0h4v4z", fill: "#aabbcc" },
  ]);
});

test("the converter bakes transforms in, scaling strokes with them", () => {
  assert.deepEqual(toArt('<g transform="translate(10 5)"><path transform="scale(2)" d="M0 0h4v4z"/></g>', 32, 32).art.paths, [
    { d: "M10 5h8v8z", fill: "#000000" },
  ]);
  assert.deepEqual(toArt('<g fill="none" stroke="#123456" stroke-width="2"><path transform="scale(3)" d="M0 0h4"/></g>', 32, 32).art.paths, [
    { d: "M0 0h12", stroke: "#123456", width: 6 },
  ]);
  assert.equal(toArt('<path stroke="#000" transform="scale(2 1)" d="M0 0h4"/>', 32, 32).reason, "transform");
});

test("the converter keeps the even-odd rule and folds opacity into each path", () => {
  assert.equal(toArt('<path fill-rule="evenodd" d="M0 0h8v8h-8zm2 2v4h4v-4z"/>', 32, 32).art.paths[0].rule, "evenodd");
  assert.equal(toArt('<g opacity=".5"><path opacity=".5" fill-opacity=".8" d="M0 0h4v4z"/></g>', 32, 32).art.paths[0].opacity, 0.2);
  assert.equal(toArt('<path fill="#000" stroke="#fff" stroke-opacity=".5" d="M0 0h4v4z"/>', 32, 32).reason, "opacity");
  assert.equal(toArt('<path fill="none" d="M0 0h4v4z"/>', 32, 32).reason, "empty");
});

test("the converter refuses what only a browser's SVG renderer can draw", () => {
  const refusals = {
    gradient: '<defs><linearGradient id="a"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path fill="url(#a)" d="M0 0h4v4z"/>',
    clipPath: '<g clip-path="url(#c)"><path d="M0 0h4v4z"/></g><defs><clipPath id="c"><path d="M0 0h32v32H0z"/></clipPath></defs>',
    use: '<defs><path id="p" d="M0 0h4v4z"/></defs><use href="#p"/>',
    dash: '<path stroke="#000" stroke-dasharray="2 2" d="M0 0h4"/>',
    style: '<path style="fill:red" d="M0 0h4v4z"/>',
    text: '<text x="0" y="0">Hi</text>',
  };
  for (const [reason, body] of Object.entries(refusals)) assert.equal(toArt(body, 32, 32).reason, reason, body);
});

test("the licence file names each set's source and terms", () => {
  const licence = readFileSync(join(dir, "LICENSE.md"), "utf8");
  for (const text of [
    "Simple Icons", "CC0 1.0", "simpleicons.org", "brand guidelines", "Phosphor", "Copyright (c) 2023 Phosphor Icons",
    "Fluent Emoji", "Copyright (c) Microsoft Corporation.", "Permission is hereby granted, free of charge",
  ]) {
    assert.ok(licence.includes(text), text);
  }
});

test("ellipses and rounded corners come out as curves, so rounding can't move their centre the way it moves an arc's", () => {
  const { art } = toArt('<ellipse cx="16" cy="12" rx="2.836" ry="1.5" transform="rotate(30 16 12)" fill="#f00"/><rect x="2" y="2" width="9" height="7" rx="2.5" fill="#00f"/>', 32, 32);
  for (const part of art.paths) assert.doesNotMatch(part.d, /[Aa]/, part.d);
  // Every point the ellipse passes through still lies on it, to well under a hundredth of its size.
  const [ellipse] = art.paths;
  let x = 0, y = 0;
  const points = [];
  for (const [, command, numbers] of ellipse.d.matchAll(/([MmCc])([^MmCcZz]*)/g)) {
    const n = numbers.match(/-?(?:\d+\.?\d*|\.\d+)/g).map(Number);
    for (let i = 0; i < n.length; i += command.toLowerCase() === "m" ? 2 : 6) {
      const [dx, dy] = command.toLowerCase() === "m" ? [n[i], n[i + 1]] : [n[i + 4], n[i + 5]];
      [x, y] = command === command.toLowerCase() ? [x + dx, y + dy] : [dx, dy];
      points.push([x, y]);
    }
  }
  const turn = (-30 * Math.PI) / 180;
  for (const [px, py] of points) {
    const u = (px - 16) * Math.cos(turn) - (py - 12) * Math.sin(turn);
    const v = (px - 16) * Math.sin(turn) + (py - 12) * Math.cos(turn);
    assert.ok(Math.abs(Math.hypot(u / 2.836, v / 1.5) - 1) < 0.01, `${px} ${py}`);
  }
});

test("opacity that a canvas would stack differently from SVG is refused rather than drawn wrong", () => {
  assert.equal(toArt('<g opacity=".5"><path fill="#000" d="M0 0h10v10z"/><path fill="#000" d="M5 5h10v10z"/></g>', 32, 32).reason, "opacity");
  assert.equal(toArt('<path fill="#000" stroke="#000" stroke-width="4" opacity=".5" d="M4 4h10v10z"/>', 32, 32).reason, "opacity");
  assert.equal(toArt('<g opacity=".5"><path fill="#000" d="M0 0h10v10z"/></g>', 32, 32).art.paths[0].opacity, 0.5);
});
