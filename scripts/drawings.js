// The drawings in the Elements panel, one list per set: brand logos from Simple Icons, icons from Phosphor and emoji
// from Microsoft's Fluent Emoji. Written at build time so the editor reads them from its own folder and never loads a
// drawing from another host.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import * as simpleIcons from "simple-icons";
import svgpath from "svgpath";

// The same checks kit.ts makes on a saved drawing, so a drawing put in a design survives a reload.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const MOST_PATH = 20_000;
const MOST_PATHS = 64;
const MOST_PATH_DATA = 60_000;
const HEX = /^[0-9a-f]{6}$/i;
// The Elements overview shows this many of each set before See all.
const FIRST = 8;
// A hundredth of a unit stays under a pixel in the 32 and 256 unit boxes these sets draw in, even across a whole frame.
const DECIMALS = 2;

/** The drawings each set shows first, in order: where a podcast clip sends people, and what a talk's clip calls for. */
export const FEATURED = {
  emoji: [
    "fire", "red-heart", "rocket", "party-popper", "hundred-points", "studio-microphone", "sparkles", "face-with-tears-of-joy",
  ],
  icons: ["microphone", "headphones", "waveform", "broadcast", "chat-circle-dots", "heart", "star", "play-circle"],
  logos: [
    "x", "youtube", "tiktok", "instagram", "facebook", "spotify", "applepodcasts", "podcastaddict", "pocketcasts",
    "overcast", "castbox", "amazonmusic", "soundcloud", "twitch", "kick", "discord", "threads", "bluesky", "mastodon",
    "telegram", "whatsapp", "reddit", "linkedin", "substack", "patreon", "medium", "pinterest", "snapchat", "github",
  ],
};

/**
 * Writes outDir/<set>.json (every drawing, featured first) and outDir/<set>.first.json (the overview's few) for the
 * emoji, icons and logos, and outDir/LICENSE.md. Says per set how many it kept, which featured ones it lacks, how many
 * it left out and why, and how big the full list is.
 */
export async function writeDrawings(outDir) {
  const built = { emoji: await emoji(), icons: await icons(), logos: await logos() };
  await mkdir(outDir, { recursive: true });
  const sets = {};
  for (const [id, set] of Object.entries(built)) {
    const byId = new Map(set.drawings.map((drawing) => [drawing.id, drawing]));
    const featured = FEATURED[id].filter((key) => byId.has(key)).map((key) => byId.get(key));
    const list = [...featured, ...set.drawings.filter((drawing) => !featured.includes(drawing))];
    const text = JSON.stringify(list);
    await writeFile(`${outDir}/${id}.json`, text);
    await writeFile(`${outDir}/${id}.first.json`, JSON.stringify(list.slice(0, FIRST)));
    sets[id] = {
      count: list.length,
      skipped: FEATURED[id].filter((key) => !byId.has(key)),
      dropped: set.dropped,
      bytes: { raw: Buffer.byteLength(text), gzip: gzipSync(text).length },
    };
  }
  await writeFile(`${outDir}/LICENSE.md`, licence(built));
  return { sets };
}

// Simple Icons is CC0, but it records a licence of its own for some icons (GPL, CC BY-SA, non-commercial and
// others). Those are left out, so every logo shipped is CC0 and the licence file can say so without exceptions.
const isCC0 = (icon) => !icon.license || icon.license.type === "CC0-1.0";

const isPath = (d) => d.length <= MOST_PATH && PATH.test(d) && /^[Mm]/.test(d);

async function logos() {
  const dropped = {};
  const kept = [];
  for (const icon of Object.values(simpleIcons)) {
    const reason = !isCC0(icon) ? "licence" : !HEX.test(icon.hex) ? "colour" : !isPath(icon.path) ? "path" : "";
    if (reason) tally(dropped, reason);
    else kept.push(icon);
  }
  kept.sort((a, b) => a.title.localeCompare(b.title, "en") || a.slug.localeCompare(b.slug, "en"));
  const drawings = kept.map((icon) => ({
    id: icon.slug,
    name: icon.title,
    art: { w: 24, h: 24, paths: [{ d: icon.path, fill: "currentColor" }] },
    color: `#${icon.hex.toLowerCase()}`,
  }));
  const bySlug = new Map(kept.map((icon) => [icon.slug, icon]));
  const guidelines = FEATURED.logos.map((slug) => bySlug.get(slug)).filter((icon) => icon?.guidelines);
  return { drawings, dropped, guidelines, version: (await json("simple-icons/package.json")).version };
}

// Phosphor draws each icon in six weights. Bold, light and thin only change the line's weight, so keeping the regular,
// fill and duotone ones gives each icon its three distinct looks at half the size.
const WEIGHTS = { "": { order: 0, label: "" }, fill: { order: 1, label: ", filled" }, duotone: { order: 2, label: ", two-tone" } };

async function icons() {
  const set = await json("@iconify-json/ph/icons.json");
  const dropped = {};
  const kept = [];
  for (const icon of iconsOf(set)) {
    const [, base, weight = ""] = icon.id.match(/^(.*?)(?:-(fill|duotone|bold|light|thin))?$/);
    if (!(weight in WEIGHTS)) continue;
    const { art, reason } = artOf(set, icon);
    if (reason) {
      tally(dropped, reason);
      continue;
    }
    const drawing = { id: icon.id, name: `${titleCase(base)}${WEIGHTS[weight].label}`, art };
    if (weight) drawing.tags = [weight];
    kept.push({ drawing, base: titleCase(base), order: WEIGHTS[weight].order });
  }
  // By the icon's name and then its weight, so the three drawings of one icon sit together.
  kept.sort((a, b) => a.base.localeCompare(b.base, "en") || a.order - b.order);
  const info = await json("@iconify-json/ph/info.json");
  return { drawings: kept.map((entry) => entry.drawing), dropped, version: info.version };
}

// Fluent draws every person and hand in five skin tones as well, named "<emoji>-light", "<emoji>-medium-dark" and so
// on. Only the default yellow one is kept; a name such as "traffic-light" has no "traffic" emoji to be a tone of.
const TONE = /-(?:medium-light|medium-dark|light|medium|dark)$/;

/** Whether an emoji id names a skin tone of another emoji in the same set. */
const isSkinTone = (id, ids) => TONE.test(id) && ids.has(id.replace(TONE, ""));

async function emoji() {
  const set = await json("@iconify-json/fluent-emoji-flat/icons.json");
  const { categories } = await json("@iconify-json/fluent-emoji-flat/metadata.json");
  const category = new Map(Object.entries(categories).flatMap(([name, ids]) => ids.map((id) => [id, name])));
  const ids = new Set([...Object.keys(set.icons), ...Object.keys(set.aliases ?? {})]);
  const dropped = {};
  const drawings = [];
  for (const icon of iconsOf(set)) {
    if (isSkinTone(icon.id, ids)) continue;
    const { art, reason } = artOf(set, icon);
    if (reason) {
      tally(dropped, reason);
      continue;
    }
    const drawing = { id: icon.id, name: sentenceCase(icon.id), art };
    if (category.has(icon.id)) drawing.tags = [category.get(icon.id)];
    drawings.push(drawing);
  }
  drawings.sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));
  const { version } = await json("@iconify-json/fluent-emoji-flat/package.json");
  return { drawings, dropped, version };
}

/**
 * Every icon in an Iconify set, and every alias that flips one. Other aliases are old names of icons already in the
 * list, so they would only show the same drawing twice.
 */
function iconsOf(set) {
  const list = Object.entries(set.icons).map(([id, icon]) => ({ ...icon, id }));
  for (const [id, alias] of Object.entries(set.aliases ?? {})) {
    const parent = set.icons[alias.parent];
    if (!parent || !(alias.hFlip || alias.vFlip || alias.rotate)) continue;
    list.push({
      ...parent,
      ...alias,
      id,
      hFlip: Boolean(parent.hFlip) !== Boolean(alias.hFlip),
      vFlip: Boolean(parent.vFlip) !== Boolean(alias.vFlip),
      rotate: ((parent.rotate ?? 0) + (alias.rotate ?? 0)) % 4,
    });
  }
  return list;
}

/** An Iconify icon as Art: its box moved to the origin and any flip drawn into the paths. */
function artOf(set, icon) {
  if (icon.rotate) return { reason: "rotate" };
  const w = icon.width ?? set.width ?? 16;
  const h = icon.height ?? set.height ?? 16;
  const left = icon.left ?? set.left ?? 0;
  const top = icon.top ?? set.top ?? 0;
  const moves = [
    icon.hFlip ? `translate(${w} 0) scale(-1 1)` : "",
    icon.vFlip ? `translate(0 ${h}) scale(1 -1)` : "",
    left || top ? `translate(${-left} ${-top})` : "",
  ].join(" ").trim();
  return toArt(moves ? `<g transform="${moves}">${icon.body}</g>` : icon.body, w, h);
}

class Refusal extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

// What each element the converter can't draw needs from a browser's SVG renderer, named for the build's tally.
const REFUSED = {
  defs: "defs", clipPath: "clipPath", mask: "mask", linearGradient: "gradient", radialGradient: "gradient", use: "use",
  symbol: "use", filter: "filter", pattern: "pattern", text: "text", image: "image", style: "style",
};
const REFUSED_ATTRIBUTES = {
  style: "style", class: "class", "clip-path": "clipPath", mask: "mask", filter: "filter", "stroke-dasharray": "dash",
  "stroke-dashoffset": "dash",
};
const GEOMETRY = {
  g: [], path: ["d"], circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"], rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"], polyline: ["points"], polygon: ["points"],
};
const PAINT = new Set(["fill", "stroke", "stroke-width", "fill-rule", "opacity", "fill-opacity", "stroke-opacity", "transform"]);
// These change nothing the canvas shows: it draws round caps and joins, a clip rule only matters inside a clipPath
// (refused anyway), and an id only matters to whatever refers to it.
const IGNORED = new Set(["stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "clip-rule", "id"]);
const IDENTITY = [1, 0, 0, 1, 0, 0];
// SVG's own defaults: an element with no fill anywhere above it is filled black.
const ROOT = { fill: "#000000", stroke: "none", width: 1, rule: "nonzero", fillOpacity: 1, strokeOpacity: 1, opacity: 1, matrix: IDENTITY };

/**
 * An SVG fragment drawn in a w by h box, as the paths of an Art, or the reason it can't be one: anything that needs a
 * browser's SVG renderer (gradients, clips, masks, filters, references, text, styles, dashes) is refused rather than
 * drawn wrong.
 */
export function toArt(body, w, h) {
  try {
    const { root, ids } = parse(body);
    const paths = [];
    for (const node of root.children) draw(node, ROOT, ids, paths);
    if (!paths.length) return { reason: "empty" };
    let total = 0;
    for (const part of paths) {
      if (!PATH.test(part.d) || !/^[Mm]/.test(part.d)) return { reason: "d" };
      total += part.d.length;
      if (part.d.length > MOST_PATH) return { reason: "size" };
    }
    if (paths.length > MOST_PATHS || total > MOST_PATH_DATA) return { reason: "size" };
    return { art: { w, h, paths } };
  } catch (error) {
    if (error instanceof Refusal) return { reason: error.reason };
    throw error;
  }
}

const TAG = /\s*<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;

/** The elements of an SVG fragment as a tree, with the element each id names; text between tags is refused. */
function parse(body) {
  const root = { name: "", attrs: {}, children: [] };
  const stack = [root];
  const ids = new Map();
  let at = 0;
  while (at < body.length) {
    TAG.lastIndex = at;
    const match = TAG.exec(body);
    if (!match) {
      if (!body.slice(at).trim()) break;
      throw new Refusal(body.slice(at).trim().startsWith("<") ? "markup" : "text");
    }
    at = TAG.lastIndex;
    const [, closing, name, rawAttrs, selfClosing] = match;
    if (closing) {
      if (stack.length < 2 || stack.pop().name !== name) throw new Refusal("markup");
      continue;
    }
    const attrs = {};
    for (const [, key, double, single] of rawAttrs.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[key] = double ?? single;
    }
    const node = { name, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (attrs.id) ids.set(attrs.id, name);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1) throw new Refusal("markup");
  return { root, ids };
}

// A defs block is named for what it holds, so the tally says "gradient" or "use" rather than "defs": a shape kept
// there is only drawn through a use.
function refusalOf(node) {
  const [first] = node.name === "defs" ? node.children : [];
  if (!first) return REFUSED[node.name] ?? node.name;
  return GEOMETRY[first.name] ? "use" : refusalOf(first);
}

function draw(node, inherited, ids, out) {
  const geometry = GEOMETRY[node.name];
  if (!geometry) throw new Refusal(refusalOf(node));
  const state = { ...inherited };
  const shape = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (geometry.includes(key)) shape[key] = value;
    else if (PAINT.has(key)) paintWith(state, key, value, ids);
    else if (!IGNORED.has(key)) throw new Refusal(REFUSED_ATTRIBUTES[key] ?? key);
  }
  if (node.name === "g") {
    const drawn = [];
    for (const child of node.children) draw(child, state, ids, drawn);
    // A faded group is faded as one in SVG; faded part by part on a canvas, its overlaps would come out darker.
    if (state.opacity < inherited.opacity && drawn.length > 1) throw new Refusal("opacity");
    out.push(...drawn);
    return;
  }
  if (node.children.length) throw new Refusal(refusalOf(node.children[0]));

  // Opacity is folded into each path, which matches SVG's group compositing wherever the paths don't overlap.
  const fillAlpha = state.opacity * state.fillOpacity;
  const strokeAlpha = state.opacity * state.strokeOpacity;
  const filled = node.name !== "line" && state.fill !== "none" && fillAlpha > 0;
  const stroked = state.stroke !== "none" && state.width > 0 && strokeAlpha > 0;
  if (!filled && !stroked) return;
  // A canvas fades a path's fill and stroke one after the other, so where they overlap a faded one comes out darker.
  if (filled && stroked && (fillAlpha !== strokeAlpha || fillAlpha < 1)) throw new Refusal("opacity");
  const d = pathData(outline(node.name, shape), state.matrix);
  if (!d) return;

  const part = { d };
  if (filled) part.fill = state.fill;
  if (stroked) {
    part.stroke = state.stroke;
    part.width = round(state.width * strokeScale(state.matrix), 3);
  }
  if (filled && state.rule === "evenodd") part.rule = "evenodd";
  const alpha = filled ? fillAlpha : strokeAlpha;
  if (alpha < 1) part.opacity = round(alpha, 3);
  out.push(part);
}

function paintWith(state, key, value, ids) {
  switch (key) {
    case "fill":
      state.fill = paint(value, ids);
      break;
    case "stroke":
      state.stroke = paint(value, ids);
      break;
    case "stroke-width":
      state.width = number(value, key);
      if (state.width < 0) throw new Refusal(key);
      break;
    case "fill-rule":
      if (value !== "nonzero" && value !== "evenodd") throw new Refusal(key);
      state.rule = value;
      break;
    case "opacity":
      state.opacity *= alpha(value, key);
      break;
    case "fill-opacity":
      state.fillOpacity = alpha(value, key);
      break;
    case "stroke-opacity":
      state.strokeOpacity = alpha(value, key);
      break;
    case "transform":
      state.matrix = multiply(state.matrix, transform(value));
      break;
  }
}

function paint(value, ids) {
  const text = value.trim();
  if (text === "none") return "none";
  if (/^currentcolor$/i.test(text)) return "currentColor";
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) return `#${[...text.slice(1).toLowerCase()].map((digit) => digit + digit).join("")}`;
  const reference = text.match(/^url\(\s*['"]?#([^'")]+)['"]?\s*\)/);
  if (reference) throw new Refusal(REFUSED[ids.get(reference[1])] ?? "url");
  throw new Refusal("paint");
}

function number(value, key) {
  const n = value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) throw new Refusal(key);
  return n;
}

function alpha(value, key) {
  const n = number(value, key);
  return Math.min(1, Math.max(0, n));
}

/** A shape's outline as path data in its own units; nothing for a shape SVG wouldn't draw. */
function outline(name, a) {
  const n = (key) => (a[key] === undefined ? 0 : number(a[key], key));
  switch (name) {
    case "path":
      return a.d ?? "";
    case "circle":
      return ellipse(n("cx"), n("cy"), n("r"), n("r"));
    case "ellipse":
      return ellipse(n("cx"), n("cy"), n("rx"), n("ry"));
    case "rect":
      return rect(n("x"), n("y"), n("width"), n("height"), a.rx === undefined ? undefined : n("rx"), a.ry === undefined ? undefined : n("ry"));
    case "line":
      return `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
    default: {
      const points = (a.points ?? "").trim().split(/[\s,]+/).filter(Boolean).map((p) => number(p, "points"));
      if (points.length % 2) throw new Refusal("points");
      return points.length ? `M${points.join(" ")}${name === "polygon" ? "Z" : ""}` : "";
    }
  }
}

const ellipse = (cx, cy, rx, ry) =>
  rx > 0 && ry > 0 ? `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z` : "";

function rect(x, y, w, h, rx, ry) {
  if (!(w > 0 && h > 0)) return "";
  // SVG takes a missing corner radius from the other one, and keeps both within half the side.
  let cx = rx ?? ry ?? 0;
  let cy = ry ?? rx ?? 0;
  cx = Math.min(Math.max(cx, 0), w / 2);
  cy = Math.min(Math.max(cy, 0), h / 2);
  if (!cx || !cy) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  const corner = (dx, dy) => `a${cx} ${cy} 0 0 1 ${dx} ${dy}`;
  return `M${x + cx} ${y}h${w - 2 * cx}${corner(cx, cy)}v${h - 2 * cy}${corner(-cx, cy)}h${2 * cx - w}${corner(-cx, -cy)}v${2 * cy - h}${corner(cx, -cy)}Z`;
}

function pathData(d, matrix) {
  const path = svgpath(d);
  if (path.err) throw new Refusal("d");
  if (matrix.some((value, i) => value !== IDENTITY[i])) path.matrix(matrix);
  // Arcs become curves first: rounding an arc's radius and ends apart can move its centre by far more than the
  // rounding, where a curve's points only move by the rounding itself.
  return compact(path.unarc().rel().round(DECIMALS));
}

/** Path data as short as it can be written: no leading zeros, and no separator a parser can do without. */
function compact(path) {
  let out = "";
  let command = "";
  let last = "";
  for (const [next, ...args] of path.segments) {
    // A moveto is always written out, since a repeated one would be read as a lineto.
    if (next !== command || next === "m" || next === "M") {
      out += next;
      last = "";
    }
    for (const value of args) {
      const text = String(value).replace(/^(-?)0\./, "$1.");
      const joins = text.startsWith("-") || (text.startsWith(".") && last.includes(".") && !last.includes("e"));
      if (last && !joins) out += " ";
      out += text;
      last = text;
    }
    command = next;
  }
  return out;
}

/** An SVG transform list as one matrix [a, b, c, d, e, f], applied right to left as SVG does. */
function transform(value) {
  const step = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/y;
  let matrix = IDENTITY;
  let at = 0;
  while (at < value.length && value.slice(at).trim()) {
    step.lastIndex = at;
    const match = step.exec(value);
    if (!match) throw new Refusal("transform");
    at = step.lastIndex;
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map((arg) => number(arg, "transform"));
    matrix = multiply(matrix, transformStep(match[1], args));
  }
  return matrix;
}

function transformStep(name, [a = 0, b, c, d, e, f]) {
  const radians = (a * Math.PI) / 180;
  switch (name) {
    case "matrix":
      if (f === undefined) throw new Refusal("transform");
      return [a, b, c, d, e, f];
    case "translate":
      return [1, 0, 0, 1, a, b ?? 0];
    case "scale":
      return [a, 0, 0, b ?? a, 0, 0];
    case "rotate": {
      const turn = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
      if (b === undefined) return turn;
      return multiply(multiply([1, 0, 0, 1, b, c ?? 0], turn), [1, 0, 0, 1, -b, -(c ?? 0)]);
    }
    case "skewX":
      return [1, 0, Math.tan(radians), 1, 0, 0];
    default:
      return [1, Math.tan(radians), 0, 1, 0, 0];
  }
}

const multiply = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
  a1 * a2 + c1 * b2,
  b1 * a2 + d1 * b2,
  a1 * c2 + c1 * d2,
  b1 * c2 + d1 * d2,
  a1 * e2 + c1 * f2 + e1,
  b1 * e2 + d1 * f2 + f1,
];

/** How much a matrix scales a stroke's width; a stretch in one direction only would change its shape, so it's refused. */
function strokeScale([a, b, c, d]) {
  const size = a * a + b * b + c * c + d * d;
  if (Math.abs(a * a + b * b - (c * c + d * d)) > size * 1e-6 || Math.abs(a * c + b * d) > size * 1e-6) {
    throw new Refusal("transform");
  }
  return Math.sqrt(Math.abs(a * d - b * c));
}

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

const titleCase = (id) => id.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const sentenceCase = (id) => {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const tally = (counts, reason) => {
  counts[reason] = (counts[reason] ?? 0) + 1;
};

const json = async (path) => JSON.parse(await readFile(new URL(`../node_modules/${path}`, import.meta.url), "utf8"));

function licence({ emoji, icons, logos }) {
  return [
    "# Drawings",
    "",
    "The drawings in this folder come from three sets, each under its own licence. Every drawing is written out as plain",
    "path data for the editor; the shapes and colours are the set's own.",
    "",
    "## Logos (logos.json)",
    "",
    `The logos in logos.json come from Simple Icons (https://simpleicons.org), version ${logos.version}, released under`,
    "CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Icons that Simple Icons lists under a",
    "licence of their own are not included.",
    "",
    "CC0 covers the drawings, not the brands. Each logo is a trademark of its owner, and using it must follow that",
    "owner's brand guidelines. Simple Icons links each brand's guidelines where it has them, at https://simpleicons.org.",
    "Showing a logo does not mean its owner endorses the clip or this project.",
    "",
    "Brand guidelines for the featured logos:",
    "",
    ...logos.guidelines.map((icon) => `- ${icon.title}: ${icon.guidelines}`),
    "",
    "## Icons (icons.json)",
    "",
    `The icons in icons.json are Phosphor Icons (https://phosphoricons.com), version ${icons.version}, from`,
    "https://github.com/phosphor-icons/core, in the regular, fill and duotone weights, under the MIT License:",
    "",
    ...mit("Copyright (c) 2023 Phosphor Icons"),
    "",
    "## Emoji (emoji.json)",
    "",
    "The emoji in emoji.json are Microsoft's Fluent Emoji in the flat style, from https://github.com/microsoft/fluentui-emoji,",
    `as packaged by Iconify (@iconify-json/fluent-emoji-flat ${emoji.version}), under the MIT License:`,
    "",
    ...mit("Copyright (c) Microsoft Corporation."),
    "",
  ].join("\n");
}

const mit = (copyright) => [
  "```",
  "MIT License",
  "",
  copyright,
  "",
  "Permission is hereby granted, free of charge, to any person obtaining a copy",
  'of this software and associated documentation files (the "Software"), to deal',
  "in the Software without restriction, including without limitation the rights",
  "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
  "copies of the Software, and to permit persons to whom the Software is",
  "furnished to do so, subject to the following conditions:",
  "",
  "The above copyright notice and this permission notice shall be included in all",
  "copies or substantial portions of the Software.",
  "",
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
  "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
  "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
  "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
  "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
  "SOFTWARE.",
  "```",
];
