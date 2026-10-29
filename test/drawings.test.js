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
// The illustration sets: a few dozen drawings each, in their own colours.
const ILLUSTRATIONS = ["people", "doodles"];

let dir;
let result;
const sets = {};
const read = (file) => JSON.parse(readFileSync(join(dir, file), "utf8"));
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "soundbite-drawings-"));
  result = await writeDrawings(dir);
  for (const id of [...SETS, ...ILLUSTRATIONS]) sets[id] = read(`${id}.json`);
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
  // The illustrations are big drawings, but there are few of them.
  for (const id of ILLUSTRATIONS) assert.ok(result.sets[id].bytes.raw < 1_500_000, `${id}: ${result.sets[id].bytes.raw}`);
});

test("people and doodles hold drawings a saved design keeps, each with its own id, in the set's own colours", () => {
  for (const id of ILLUSTRATIONS) {
    const list = sets[id];
    assert.ok(list.length >= 25, `${id}: ${list.length}`);
    assert.equal(result.sets[id].count, list.length, id);
    assert.equal(new Set(list.map((drawing) => drawing.id)).size, list.length, id);
    for (const { id: key, name, tags, art } of list) {
      assert.ok(name && tags.length, key);
      assert.ok(art.w > 0 && art.h > 0, key);
      assert.ok(art.paths.length > 0 && art.paths.length <= 64, key);
      let total = 0;
      for (const part of art.paths) {
        assert.match(part.d, PATH, key);
        assert.match(part.d, /^[Mm]/, key);
        assert.ok(part.d.length <= 20000, key);
        total += part.d.length;
        // Literal colours, so a drawing looks as its artist drew it whatever colour the layer is given.
        for (const paint of [part.fill, part.stroke].filter(Boolean)) assert.match(paint, /^#[0-9a-f]{6}$/, key);
      }
      assert.ok(total <= 60000, key);
    }
  }
});

test("people and doodles lead with their featured drawings, none missing, and the first files hold them", () => {
  for (const id of ILLUSTRATIONS) {
    assert.equal(FEATURED[id].length, 8, id);
    assert.deepEqual(result.sets[id].skipped, [], id);
    assert.deepEqual(sets[id].slice(0, 8).map((drawing) => drawing.id), FEATURED[id], id);
    assert.deepEqual(read(`${id}.first.json`), sets[id].slice(0, 8), id);
    const rest = sets[id].slice(8);
    assert.deepEqual(rest.map((drawing) => drawing.name), rest.toSorted(byName).map((drawing) => drawing.name), id);
  }
});

test("people are every Open Peeps head of hair as a bust and every face on a head, in black line on white", () => {
  const people = sets.people;
  const busts = people.filter((drawing) => drawing.id.startsWith("peep-"));
  const faces = people.filter((drawing) => drawing.id.startsWith("face-"));
  const figures = people.filter((drawing) => drawing.id.startsWith("humaaan-"));
  assert.equal(busts.length + faces.length + figures.length, people.length);
  assert.equal(busts.length, 48);
  assert.equal(faces.length, 30);
  for (const drawing of busts) assert.deepEqual(drawing.tags, ["person", "bust", "peeps"], drawing.id);
  for (const drawing of faces) assert.deepEqual(drawing.tags.slice(0, 3), ["face", "head", "peeps"], drawing.id);
  for (const drawing of [...busts, ...faces]) {
    const fills = new Set(drawing.art.paths.map((part) => part.fill));
    assert.ok(fills.has("#000000") && fills.has("#ffffff"), drawing.id);
  }
  const byId = new Map(people.map((drawing) => [drawing.id, drawing]));
  assert.equal(byId.get("peep-bantu-knots")?.name, "Peep, bantu knots");
  assert.equal(byId.get("face-loving-grin-1")?.name, "Face, loving grin 1");
  assert.ok(byId.get("face-smile-big").tags.includes("happy"));
  // A bust stands on its shoulders, so it is taller than a face, which is only a head.
  assert.ok(byId.get("peep-afro").art.h > byId.get("face-smile").art.h * 1.5);
});

test("people end with the Humaaans figures, standing or sitting, in their own colours", () => {
  const people = sets.people;
  const figures = people.filter((drawing) => drawing.id.startsWith("humaaan-"));
  // Two of the 32 draw a turban through a mask, which the converter refuses rather than draws wrong.
  assert.deepEqual(result.sets.people.dropped, { use: 2 });
  assert.equal(figures.length, 30);
  const standing = figures.filter((drawing) => drawing.tags.includes("standing"));
  const sitting = figures.filter((drawing) => drawing.tags.includes("sitting"));
  assert.deepEqual([standing.length, sitting.length], [22, 8]);
  for (const drawing of figures) {
    assert.deepEqual(drawing.tags.slice(0, 4), ["person", "full body", drawing.id.split("-")[1], "humaaans"], drawing.id);
    assert.match(drawing.name, /^(Standing|Sitting), [a-z]/, drawing.id);
    // Flat colour figures, not Open Peeps' black line on white.
    assert.ok(new Set(drawing.art.paths.map((part) => part.fill)).size >= 4, drawing.id);
  }
  // After the busts and faces, apart from the two the overview features.
  const rest = people.slice(8);
  const first = rest.findIndex((drawing) => drawing.id.startsWith("humaaan-"));
  assert.ok(rest.slice(first).every((drawing) => drawing.id.startsWith("humaaan-")));
  const byId = new Map(figures.map((drawing) => [drawing.id, drawing]));
  assert.equal(byId.get("humaaan-sitting-3")?.name, "Sitting, beard, in a wheelchair");
  assert.ok(byId.get("humaaan-sitting-3").tags.includes("wheelchair"));
  // A standing figure is taller than it is wide, and fitted to its shapes rather than the 380 by 480 artboard.
  const { w, h } = byId.get("humaaan-standing-1").art;
  assert.ok(h > w && w < 380 && h < 480, `${w} by ${h}`);
});

test("doodles keep Open Doodles' black ink and pink accent, named after their files", () => {
  const doodles = sets.doodles;
  for (const drawing of doodles) {
    const fills = new Set(drawing.art.paths.map((part) => part.fill));
    assert.deepEqual([...fills].toSorted(), ["#000000", "#ff5678"], drawing.id);
    assert.equal(drawing.tags[0], "doodle", drawing.id);
  }
  const byId = new Map(doodles.map((drawing) => [drawing.id, drawing]));
  assert.equal(byId.get("ice-cream")?.name, "Ice cream");
  assert.ok(byId.get("dog-jump").tags.includes("dog"));
  // Each is in the box its ink reaches, not the 1024 by 768 page it was drawn on.
  for (const drawing of doodles) assert.ok(drawing.art.w * drawing.art.h < 1024 * 768, drawing.id);
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
    "## People (people.json)", "Open Peeps by Pablo Stanley", "https://www.openpeeps.com", "@dicebear/open-peeps",
    "Humaaans by Pablo Stanley", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/",
    "https://github.com/Calinou/humaaans at commit 818f184",
    "## Doodles (doodles.json)", "Open Doodles by Pablo Stanley", "https://www.opendoodles.com", "react-open-doodles",
    "https://creativecommons.org/publicdomain/zero/1.0/",
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

// A grid of small squares as one path's subpaths, none touching another: 1,600 of them write out well past one path.
const squares = (left, top, step, side) => {
  const out = [];
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 40; j++) out.push(`M${(left + i * step).toFixed(2)} ${(top + j * step).toFixed(2)}h${side}v${side}h-${side}z`);
  }
  return out.join("");
};
const subpaths = (d) => d.match(/[Mm]/g).length;

test("a path too long for a saved design is shared out among a few that draw the same", () => {
  const { art } = toArt(`<path d="${squares(0.13, 0.13, 0.5, 0.25)}"/>`, 32, 32);
  assert.ok(art.paths.length > 1);
  for (const part of art.paths) {
    assert.ok(part.d.length <= 20000, String(part.d.length));
    assert.equal(part.fill, "#000000");
  }
  assert.equal(art.paths.reduce((sum, part) => sum + subpaths(part.d), 0), 1600);
  // Squares outside an L's arms stay apart from it, though its box covers them all.
  const { art: beside } = toArt(`<path d="M0 0h1v30h30v1h-31z${squares(2.13, 0.13, 0.45, 0.2)}"/>`, 32, 32);
  assert.ok(beside.paths.length > 1);
  assert.equal(beside.paths.reduce((sum, part) => sum + subpaths(part.d), 0), 1601);
});

test("a long path whose parts meet stays whole, or is refused when it can't", () => {
  // Inside a frame the squares are holes it cuts or shapes it covers, so they draw the same only in its path.
  assert.equal(toArt(`<path fill-rule="evenodd" d="M-1 -1h40v40h-40z${squares(0.13, 0.13, 0.5, 0.25)}"/>`, 32, 32).reason, "size");
  // One long zigzag is one subpath: a 1024 unit box can write it in whole units, a 32 unit box can't afford to.
  const points = Array.from({ length: 3500 }, (_, i) => `${(i * 0.3).toFixed(1)} ${i % 2 ? 1.7 : 0}`);
  const zigzag = `<path d="M${points.join(" ")}z"/>`;
  const { art } = toArt(zigzag, 1100, 1100);
  assert.equal(art.paths.length, 1);
  assert.ok(art.paths[0].d.length <= 20000 && !art.paths[0].d.includes("."));
  assert.equal(toArt(zigzag, 32, 32).reason, "size");
});

test("a big box writes tenths of a unit and a small one hundredths", () => {
  const body = '<path d="M0.123 0.456h10.789v1z"/>';
  assert.equal(toArt(body, 1024, 1024).art.paths[0].d, "M.1.5h10.8v1z");
  assert.equal(toArt(body, 32, 32).art.paths[0].d, "M.12.46h10.79v1z");
});
