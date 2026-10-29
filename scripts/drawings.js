// The drawings in the Elements panel, one list per set: brand logos from Simple Icons, icons from Phosphor, emoji from
// Microsoft's Fluent Emoji, and Pablo Stanley's Open Peeps and Open Doodles. Written at build time so the editor reads them from its own folder and never loads a
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
// A tenth of a unit does the same in the 700 to 1024 unit boxes of the illustrations, and keeps their long paths short.
const BIG_BOX = 512;

/** The drawings each set shows first, in order: where a podcast clip sends people, and what a talk's clip calls for. */
export const FEATURED = {
  emoji: [
    "fire", "red-heart", "rocket", "party-popper", "hundred-points", "studio-microphone", "sparkles", "face-with-tears-of-joy",
  ],
  icons: ["microphone", "headphones", "waveform", "broadcast", "chat-circle-dots", "heart", "star", "play-circle"],
  people: [
    "face-smile-big", "face-loving-grin-2", "face-calm", "face-awe", "face-smile-lol", "peep-bun", "peep-afro", "peep-long-curly",
  ],
  doodles: ["loving", "coffee", "dancing", "meditating", "reading", "selfie", "doggie", "groovy"],
  logos: [
    "x", "youtube", "tiktok", "instagram", "facebook", "spotify", "applepodcasts", "podcastaddict", "pocketcasts",
    "overcast", "castbox", "amazonmusic", "soundcloud", "twitch", "kick", "discord", "threads", "bluesky", "mastodon",
    "telegram", "whatsapp", "reddit", "linkedin", "substack", "patreon", "medium", "pinterest", "snapchat", "github",
  ],
};

/**
 * Writes outDir/<set>.json (every drawing, featured first) and outDir/<set>.first.json (the overview's few) for the
 * emoji, icons, people, doodles and logos, and outDir/LICENSE.md. Says per set how many it kept, which featured ones it lacks, how many
 * it left out and why, and how big the full list is.
 */
export async function writeDrawings(outDir) {
  const built = { emoji: await emoji(), icons: await icons(), people: await people(), doodles: await doodles(), logos: await logos() };
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

// Open Peeps as DiceBear packages it: Pablo Stanley's parts as SVG templates with slots for the skin, shirt and hair
// colours, and the shoulders they sit on. The files are read as text, never run.
const PEEPS = "@dicebear/open-peeps/lib";
// Open Peeps draws people in black line on white; the shirts take DiceBear's colours in turn.
const PEEP_COLORS = { skin: "#ffffff", headContrast: "#2c1b18" };
const SHIRTS = ["#8fa7df", "#e78276", "#78e185", "#ffcf77", "#e279c7", "#9ddadb", "#fdea6b"];
// A bust wears the library's friendlier faces in turn, since the people in a clip are mostly glad to be there.
const BUST_FACES = [
  "smile", "calm", "cheeky", "smileBig", "cute", "lovingGrin1", "explaining", "smileTeethGap", "driven", "lovingGrin2", "eyesClosed", "awe",
];
// Each face is drawn under a different head of hair, so the faces read as different people rather than one.
const FACE_HEADS = [
  "short1", "medium1", "afro", "bun", "noHair2", "long", "twists", "shaved2", "mediumBangs", "hijab", "flatTop", "longCurly", "grayShort", "pomp",
  "bantuKnots",
];
// What a search for a feeling should find among the faces.
const MOODS = {
  angryWithFang: ["angry"], awe: ["amazed", "wow"], blank: ["neutral"], calm: ["relaxed"], cheeky: ["playful"],
  concerned: ["worried"], concernedFear: ["worried", "scared"], contempt: ["smug"], cute: ["happy"], cyclops: ["monster"],
  driven: ["determined"], eatingHappy: ["happy", "food"], explaining: ["talking"], eyesClosed: ["peaceful"], fear: ["scared"],
  hectic: ["stressed"], lovingGrin1: ["love", "happy"], lovingGrin2: ["love", "happy"], monster: ["scary"], old: ["elderly"],
  rage: ["angry"], serious: ["neutral"], smile: ["happy"], smileBig: ["happy"], smileLOL: ["laughing", "happy"],
  smileTeethGap: ["happy"], solemn: ["sad"], suspicious: ["doubtful"], tired: ["sleepy"], veryAngry: ["angry"],
};

/** Each Open Peeps head of hair on the shoulders with a face, and each face on a head of its own. */
async function people() {
  const body = (await text(`${PEEPS}/index.js`)).match(/body: `([^]*?)`,\n\s*extra:/)?.[1];
  const heads = templates(await text(`${PEEPS}/components/head.js`));
  const faces = templates(await text(`${PEEPS}/components/face.js`));
  if (!body || !body.startsWith("<g") || !heads.short1 || !faces.smile) throw new Error(`${PEEPS} has changed shape`);
  // The body draws the shoulders first, then a slot for each part; without the shoulders, a face is just a head.
  const shoulders = body.indexOf("</g>") + "</g>".length;
  const peep = (template, parts, shirt) =>
    colored(template.replace(PART, (_, slot) => parts[slot] ?? ""), { ...PEEP_COLORS, clothing: shirt });
  const dropped = {};
  const drawings = [];
  const keep = (drawing, markup) => {
    const { art, reason } = fitted(markup, 704, 704);
    if (reason) tally(dropped, reason);
    else drawings.push({ ...drawing, art });
  };
  Object.entries(heads).forEach(([head, template], i) => {
    const markup = peep(body, { head: template, face: faces[BUST_FACES[i % BUST_FACES.length]] }, SHIRTS[i % SHIRTS.length]);
    keep({ id: `peep-${kebab(head)}`, name: `Peep, ${words(head)}`, tags: ["person", "bust", "peeps"] }, markup);
  });
  Object.entries(faces).forEach(([face, template], i) => {
    const markup = peep(body.slice(shoulders), { head: heads[FACE_HEADS[i % FACE_HEADS.length]], face: template }, SHIRTS[0]);
    keep({ id: `face-${kebab(face)}`, name: `Face, ${words(face)}`, tags: ["face", "head", "peeps", ...(MOODS[face] ?? [])] }, markup);
  });
  drawings.sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));
  const { version } = await json("@dicebear/open-peeps/package.json");
  return { drawings, dropped, version };
}

// A slot in DiceBear's body template, which draws a part when the avatar has one.
const PART = /\$\{\(_\w+ = \(_\w+ = components\.(\w+)\)[^}]*\}/g;

/** The templates in one of DiceBear's component files, by name. */
const templates = (source) =>
  Object.fromEntries([...source.matchAll(/^ {4}(\w+): \(components, colors\) => `(.*)`,?$/gm)].map(([, name, template]) => [name, template]));

/** A template with its colour slots filled; any other slot means the package has changed shape. */
function colored(template, colors) {
  const markup = template.replace(/\$\{escape\.xml\(`\$\{colors\.(\w+)\}`\)\}/g, (_, key) => colors[key] ?? "${}");
  if (markup.includes("${")) throw new Error(`${PEEPS} has a slot this build doesn't fill`);
  return markup;
}

// Open Doodles as react-open-doodles packages it: each doodle a React component that writes out the SVG it was made
// from as createElement calls, in an ink and an accent colour. The bundle is read as text, never run.
const DOODLES = "react-open-doodles/dist/index.es.js";
// What a search should find each doodle by, past its name.
const DOODLE_TAGS = {
  "dog-jump": ["dog", "pet"], doggie: ["dog", "pet"], petting: ["dog", "pet"], coffee: ["drink", "cafe"],
  "ice-cream": ["food", "dessert"], reading: ["book"], "reading-side": ["book"], "sitting-reading": ["book"],
  meditating: ["yoga", "calm"], dancing: ["dance", "music"], groovy: ["dance", "music"], moshing: ["dance", "music"],
  ballet: ["dance"], running: ["sport"], sprinting: ["sport"], jumping: ["sport"], "roller-skating": ["sport"],
  loving: ["love", "heart"], selfie: ["phone", "photo"], unboxing: ["box", "delivery"], plant: ["nature"],
  zombieing: ["zombie", "halloween"], levitate: ["float"], float: ["swim"], bikini: ["beach", "summer"],
};

async function doodles() {
  const source = await text(DOODLES);
  const colors = { ink: constant(source, "DEFAULT_INK"), accent: constant(source, "DEFAULT_ACCENT") };
  const dropped = {};
  const drawings = [];
  for (const match of source.matchAll(/var (\w+)Doodle = function \(_a\) \{[^]*?return \(/g)) {
    const { node } = element(source, match.index + match[0].length, colors);
    const [, , w, h] = (node.attrs.viewBox ?? "").split(" ").map(Number);
    if (node.type !== "svg" || !(w > 0 && h > 0)) throw new Error(`${DOODLES} has changed shape`);
    const { art, reason } = fitted(node.children.map(markup).join(""), w, h);
    if (reason) {
      tally(dropped, reason);
      continue;
    }
    const id = kebab(match[1]);
    drawings.push({ id, name: sentenceCase(id), art, tags: ["doodle", "person", ...(DOODLE_TAGS[id] ?? [])] });
  }
  if (!drawings.length) throw new Error(`${DOODLES} has changed shape`);
  drawings.sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));
  const { version } = await json("react-open-doodles/package.json");
  return { drawings, dropped, version };
}

function constant(source, name) {
  const value = source.match(new RegExp(`var ${name} = "(#[0-9a-fA-F]{3,6})";`))?.[1];
  if (!value) throw new Error(`${DOODLES} has no ${name}`);
  return value;
}

const CALL = /\s*React\.createElement\("(\w+)",\s*(null|\{)/y;
const PROP = /\s*(\w+):\s*(?:"((?:[^"\\]|\\.)*)"|(\w+))\s*(,|\})/y;
const NEXT = /\s*(,|\))/y;

/**
 * The React.createElement call at `at` as an element tree, and where the call ends. A prop is a string, or the name of
 * one of `names`; anything else means the bundle has changed shape.
 */
function element(source, at, names) {
  const call = sticky(CALL, source, at);
  if (!call) throw new Error(`${DOODLES}: no element at ${at}`);
  at = CALL.lastIndex;
  const node = { type: call[1], attrs: {}, children: [] };
  if (call[2] === "{") {
    for (;;) {
      const prop = sticky(PROP, source, at);
      if (!prop) throw new Error(`${DOODLES}: unreadable prop at ${at}`);
      at = PROP.lastIndex;
      const [, key, string, name, end] = prop;
      if (string === undefined && !(name in names)) throw new Error(`${DOODLES}: unknown value ${name}`);
      node.attrs[key] = string === undefined ? names[name] : JSON.parse(`"${string}"`);
      if (end === "}") break;
    }
  }
  for (;;) {
    const next = sticky(NEXT, source, at);
    if (!next) throw new Error(`${DOODLES}: unreadable children at ${at}`);
    at = NEXT.lastIndex;
    if (next[1] === ")") return { node, at };
    const child = element(source, at, names);
    node.children.push(child.node);
    at = child.at;
  }
}

const sticky = (pattern, source, at) => {
  pattern.lastIndex = at;
  return pattern.exec(source);
};

/** An element tree as SVG markup, its React prop names (fillRule) back in SVG's spelling (fill-rule). */
const markup = ({ type, attrs, children }) => {
  const props = Object.entries(attrs).map(([key, value]) => ` ${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"`);
  return `<${type}${props.join("")}>${children.map(markup).join("")}</${type}>`;
};

/**
 * An illustration as Art in the box its paths reach rather than its canvas's, so a picked drawing's frame hugs it.
 * The box is found from a first conversion and the drawing converted again, moved into it.
 */
function fitted(body, w, h) {
  const first = toArt(body, w, h);
  if (!first.art) return first;
  const reach = first.art.paths.map((part) => boxOf(svgpath(part.d).abs().segments, (part.width ?? 0) / 2)).reduce(union);
  const [left, top] = reach.slice(0, 2).map(Math.floor);
  const [right, bottom] = reach.slice(2).map(Math.ceil);
  return toArt(`<g transform="translate(${-left} ${-top})">${body}</g>`, right - left, bottom - top);
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
 * drawn wrong. A path too long for a saved design is split into a few that draw the same, where its parts allow it.
 */
export function toArt(body, w, h) {
  try {
    const { root, ids } = parse(body);
    const scope = { ids, places: Math.max(w, h) > BIG_BOX ? 1 : DECIMALS };
    const paths = [];
    for (const node of root.children) draw(node, ROOT, scope, paths);
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

function draw(node, inherited, scope, out) {
  const geometry = GEOMETRY[node.name];
  if (!geometry) throw new Refusal(refusalOf(node));
  const state = { ...inherited };
  const shape = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (geometry.includes(key)) shape[key] = value;
    else if (PAINT.has(key)) paintWith(state, key, value, scope.ids);
    else if (!IGNORED.has(key)) throw new Refusal(REFUSED_ATTRIBUTES[key] ?? key);
  }
  if (node.name === "g") {
    const drawn = [];
    for (const child of node.children) draw(child, state, scope, drawn);
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
  const width = stroked ? round(state.width * strokeScale(state.matrix), 3) : 0;
  for (const d of pathData(outline(node.name, shape), state.matrix, scope.places, width / 2)) {
    const part = { d };
    if (filled) part.fill = state.fill;
    if (stroked) {
      part.stroke = state.stroke;
      part.width = width;
    }
    if (filled && state.rule === "evenodd") part.rule = "evenodd";
    const alpha = filled ? fillAlpha : strokeAlpha;
    if (alpha < 1) part.opacity = round(alpha, 3);
    out.push(part);
  }
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

/**
 * A shape's outline as path data, one path or, when one would be too long for a saved design, a few; none for an empty
 * outline. `reach` is how far the paint spreads past the outline: half the stroke's width.
 */
function pathData(d, matrix, places, reach) {
  const path = svgpath(d);
  if (path.err) throw new Refusal("d");
  if (matrix.some((value, i) => value !== IDENTITY[i])) path.matrix(matrix);
  // Arcs become curves first: rounding an arc's radius and ends apart can move its centre by far more than the
  // rounding, where a curve's points only move by the rounding itself.
  path.unarc();
  const whole = compact(svgpath.from(path).rel().round(places));
  if (whole.length <= MOST_PATH) return whole ? [whole] : [];
  const segments = path.abs().segments;
  try {
    return split(segments, places, reach);
  } catch (error) {
    // Still too long: a big box can take whole units, which stay within a pixel of a 1024 unit drawing even when it
    // spans a whole frame.
    if (!(error instanceof Refusal) || places !== DECIMALS - 1) throw error;
    return split(segments, 0, reach);
  }
}

/**
 * A long path's subpaths shared out among as few paths as hold them. Subpaths whose paint could meet stay in one path,
 * since a hole the even-odd rule cuts, a shape cut out by winding the other way, or a faded overlap only comes out
 * the same within one path. A stroke's subpaths meet wherever their boxes do; a fill's only where their outlines cross
 * or one lies inside the other, since a doodle's big outline has a box over most of its other strokes.
 */
function split(segments, places, reach) {
  const parts = subpathsOf(segments).map((subpath) => ({ subpath, box: boxOf(subpath, reach), outline: reach ? [] : outlineOf(subpath) }));
  const leader = parts.map((_, i) => i);
  const lead = (i) => (leader[i] === i ? i : (leader[i] = lead(leader[i])));
  parts.forEach((a, i) => {
    for (let j = i + 1; j < parts.length; j++) {
      const b = parts[j];
      if (lead(i) !== lead(j) && overlaps(a.box, b.box) && (reach || meets(a.outline, b.outline))) leader[lead(j)] = lead(i);
    }
  });
  const byLeader = new Map();
  parts.forEach((part, i) => byLeader.set(lead(i), [...(byLeader.get(lead(i)) ?? []), part.subpath]));
  const write = (subpaths) => compact(svgpath(written(subpaths.flat())).rel().round(places));
  const out = [];
  let held = [];
  for (const subpaths of byLeader.values()) {
    if (write(subpaths).length > MOST_PATH) throw new Refusal("size");
    if (held.length && write([...held, ...subpaths]).length > MOST_PATH) {
      out.push(write(held));
      held = [];
    }
    held.push(...subpaths);
  }
  out.push(write(held));
  return out;
}

const written = (segments) => segments.map((segment) => segment.join(" ")).join(" ");

/** Absolute path segments, cut where each subpath starts. */
function subpathsOf(segments) {
  const subpaths = [];
  for (const segment of segments) {
    if (segment[0] === "M" || !subpaths.length) subpaths.push([]);
    subpaths.at(-1).push(segment);
  }
  return subpaths;
}

/** The box [left, top, right, bottom] around the points and control points of some segments, grown by `reach`. */
function boxOf(segments, reach) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const take = (x, y) => {
    box[0] = Math.min(box[0], x - reach);
    box[1] = Math.min(box[1], y - reach);
    box[2] = Math.max(box[2], x + reach);
    box[3] = Math.max(box[3], y + reach);
  };
  svgpath(written(segments)).abs().iterate(([command, ...args], _, x, y) => {
    if (command === "H") take(args[0], y);
    else if (command === "V") take(x, args[0]);
    else for (let i = 0; i + 1 < args.length; i += 2) take(args[i], args[i + 1]);
  });
  return box;
}

// Steps a curve is followed in to tell whether two outlines meet: a curve the size of a doodle's hand strays from its
// steps by about a tenth of a unit, the rounding the paths are written to anyway.
const CURVE_STEPS = 8;

/** A subpath's outline as a closed polygon [[x, y], ...], its curves followed in steps. */
function outlineOf(segments) {
  const points = [];
  svgpath(written(segments)).abs().unshort().iterate(([command, ...args], _, x, y) => {
    if (command === "H") points.push([args[0], y]);
    else if (command === "V") points.push([x, args[0]]);
    else if (command === "C" || command === "Q") {
      const controls = [[x, y]];
      for (let i = 0; i < args.length; i += 2) controls.push([args[i], args[i + 1]]);
      for (let step = 1; step <= CURVE_STEPS; step++) points.push(bezier(controls, step / CURVE_STEPS));
    } else if (command !== "Z") points.push([args.at(-2), args.at(-1)]);
  });
  return points;
}

/** The point at t along a Bézier curve, by de Casteljau's halving of its control points. */
function bezier(controls, t) {
  let row = controls;
  while (row.length > 1) row = row.slice(1).map(([x, y], i) => [row[i][0] + (x - row[i][0]) * t, row[i][1] + (y - row[i][1]) * t]);
  return row[0];
}

/** Whether two closed outlines' insides meet: their edges cross or touch, or a corner of one lies inside the other. */
const meets = (a, b) => a.some(([x, y]) => winding(b, x, y)) || b.some(([x, y]) => winding(a, x, y)) || crosses(a, b);

/** How many times a closed outline winds around a point, by the signed crossings of a ray to its right. */
function winding(outline, x, y) {
  let turns = 0;
  outline.forEach(([x1, y1], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    const side = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
    if (y1 <= y && y2 > y && side > 0) turns++;
    else if (y1 > y && y2 <= y && side < 0) turns--;
  });
  return turns;
}

function crosses(a, b) {
  const edges = (outline) => outline.map((point, i) => [point, outline[(i + 1) % outline.length]]);
  const turn = ([x1, y1], [x2, y2], [x3, y3]) => Math.sign((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1));
  const within = ([x1, y1], [x2, y2], [x, y]) => Math.min(x1, x2) <= x && x <= Math.max(x1, x2) && Math.min(y1, y2) <= y && y <= Math.max(y1, y2);
  const theirs = edges(b);
  return edges(a).some(([p, q]) =>
    theirs.some(([r, s]) => {
      const [d1, d2, d3, d4] = [turn(r, s, p), turn(r, s, q), turn(p, q, r), turn(p, q, s)];
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
      return (!d1 && within(r, s, p)) || (!d2 && within(r, s, q)) || (!d3 && within(p, q, r)) || (!d4 && within(p, q, s));
    }),
  );
}

const overlaps = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

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

/** A camel-case name's words, apart and in lower case: bantuKnots, dreads1 and smileLOL become "bantu knots", "dreads 1" and "smile lol". */
const words = (name) => name.replace(/([a-z])(?=[A-Z0-9])|([0-9])(?=[A-Za-z])/g, "$1$2 ").toLowerCase();

const kebab = (name) => words(name).replaceAll(" ", "-");

const sentenceCase = (id) => {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const tally = (counts, reason) => {
  counts[reason] = (counts[reason] ?? 0) + 1;
};

const text = (path) => readFile(new URL(`../node_modules/${path}`, import.meta.url), "utf8");

const json = async (path) => JSON.parse(await text(path));

function licence({ emoji, icons, people, doodles, logos }) {
  return [
    "# Drawings",
    "",
    "The drawings in this folder come from five sets, each under its own licence. Every drawing is written out as plain",
    "path data for the editor; the shapes and colours are the set's own.",
    "",
    "## People (people.json)",
    "",
    "The people and faces in people.json are Open Peeps by Pablo Stanley (https://www.openpeeps.com), released under",
    "CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Each bust is one of the library's heads of",
    "hair with one of its faces on its shoulders, and each face is drawn on one of its heads, put together the way",
    `DiceBear's Open Peeps style puts them together, from @dicebear/open-peeps ${people.version}`,
    "(https://github.com/dicebear/dicebear), whose licence lists the design as Open Peeps by Pablo Stanley under CC0 1.0.",
    "",
    "## Doodles (doodles.json)",
    "",
    "The doodles in doodles.json are Open Doodles by Pablo Stanley (https://www.opendoodles.com), released under",
    "CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/), as packaged in react-open-doodles",
    `${doodles.version} (https://github.com/lunahq/react-open-doodles).`,
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
