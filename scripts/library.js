// The editor's library of drawings, built from free icon sets: graphics.json holds line icons, flat colour icons and
// the marks of the places a podcast is heard or followed; stickers.json holds a hand-picked set of colour emoji. Every
// icon is flattened to path data here, so the editor paints it with Path2D and never through an <img>.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { svgToArt, Unsupported } from "./svg-paths.js";

// The marks a podcaster puts on a clip to say where to listen or follow, by their slug in the brand set.
const BRANDS = [
  ["spotify", "spotify"],
  ["applepodcasts", "apple podcasts"],
  ["youtube", "youtube"],
  ["youtubemusic", "youtube music"],
  ["x", "x"],
  ["tiktok", "tiktok"],
  ["instagram", "instagram"],
  ["facebook", "facebook"],
  ["linkedin", "linkedin"],
  ["twitch", "twitch"],
  ["discord", "discord"],
  ["patreon", "patreon"],
  ["soundcloud", "soundcloud"],
  ["amazonmusic", "amazon music"],
  ["pocketcasts", "pocket casts"],
  ["overcast", "overcast"],
  ["castbox", "castbox"],
  ["podcastaddict", "podcast addict"],
  ["iheartradio", "iheartradio"],
  ["deezer", "deezer"],
  ["substack", "substack"],
  ["medium", "medium"],
  ["github", "github"],
  ["telegram", "telegram"],
  ["whatsapp", "whatsapp"],
  ["threads", "threads"],
  ["bluesky", "bluesky"],
  ["mastodon", "mastodon"],
  ["reddit", "reddit"],
  ["snapchat", "snapchat"],
  ["pinterest", "pinterest"],
  ["kick", "kick"],
  ["rumble", "rumble"],
  ["audible", "audible"],
  ["googlepodcasts", "google podcasts"],
];

// The emoji kept as stickers, grouped by what a clip about a conversation tends to reach for.
const STICKERS = [
  // Faces
  `grinning-face grinning-face-with-smiling-eyes grinning-squinting-face grinning-face-with-sweat
  rolling-on-the-floor-laughing face-with-tears-of-joy slightly-smiling-face upside-down-face melting-face
  winking-face smiling-face-with-halo smiling-face-with-hearts smiling-face-with-heart-eyes star-struck
  face-blowing-a-kiss winking-face-with-tongue zany-face hugging-face face-with-hand-over-mouth face-with-peeking-eye
  shushing-face thinking-face saluting-face face-with-raised-eyebrow neutral-face smirking-face unamused-face
  face-with-rolling-eyes grimacing-face face-exhaling shaking-face sleeping-face hot-face woozy-face
  face-with-spiral-eyes exploding-head cowboy-hat-face partying-face smiling-face-with-sunglasses nerd-face
  astonished-face flushed-face pleading-face face-holding-back-tears crying-face loudly-crying-face
  face-screaming-in-fear yawning-face face-with-steam-from-nose pouting-face face-with-symbols-on-mouth skull
  pile-of-poo clown-face ghost alien robot see-no-evil-monkey hear-no-evil-monkey speak-no-evil-monkey`,
  // Hands and body
  `waving-hand raised-hand hand-with-fingers-splayed ok-hand victory-hand crossed-fingers love-you-gesture
  sign-of-the-horns backhand-index-pointing-left backhand-index-pointing-right backhand-index-pointing-up
  backhand-index-pointing-down index-pointing-up index-pointing-at-the-viewer thumbs-up thumbs-down raised-fist
  clapping-hands raising-hands heart-hands open-hands handshake folded-hands writing-hand flexed-biceps eyes brain
  speaking-head`,
  // Hearts
  `red-heart orange-heart yellow-heart green-heart blue-heart light-blue-heart purple-heart brown-heart black-heart
  grey-heart white-heart pink-heart heart-on-fire broken-heart two-hearts revolving-hearts sparkling-heart
  heart-with-arrow kiss-mark`,
  // Stars, fire, sparkles and speech
  `star glowing-star shooting-star sparkles sparkle dizzy fire collision high-voltage hundred-points sweat-droplets
  zzz speech-balloon thought-balloon left-speech-bubble bomb`,
  // Party
  `party-popper confetti-ball balloon wrapped-gift birthday-cake fireworks sparkler mirror-ball clinking-glasses
  bottle-with-popping-cork crown gem-stone admission-tickets`,
  // Music, sound and screens
  `musical-note musical-notes microphone studio-microphone headphone radio loudspeaker speaker-high-volume
  muted-speaker megaphone bell guitar musical-keyboard violin drum control-knobs play-button pause-button stop-button
  record-button antenna-bars television movie-camera clapper-board video-camera camera-with-flash mobile-phone laptop`,
  // Money and charts
  `money-bag money-with-wings dollar-banknote euro-banknote coin credit-card chart-increasing chart-decreasing
  bar-chart`,
  // Arrows
  `up-arrow down-arrow left-arrow right-arrow up-right-arrow down-right-arrow left-right-arrow up-down-arrow
  right-arrow-curving-left left-arrow-curving-right right-arrow-curving-up clockwise-vertical-arrows
  counterclockwise-arrows-button`,
  // Marks and signs
  `check-mark check-mark-button check-box-with-check cross-mark cross-mark-button warning no-entry prohibited
  red-exclamation-mark red-question-mark double-exclamation-mark exclamation-question-mark plus minus information
  new-button cool-button sos-button red-circle green-circle hollow-red-circle`,
  // Ideas, wins and work
  `light-bulb rocket trophy 1st-place-medal 2nd-place-medal 3rd-place-medal bullseye gear link locked key
  magnifying-glass-tilted-left round-pushpin memo pencil books graduation-cap envelope newspaper
  globe-showing-americas`,
  // Time
  `alarm-clock stopwatch timer-clock hourglass-done hourglass-not-done watch calendar spiral-calendar
  tear-off-calendar`,
  // Coffee and food
  `hot-beverage bubble-tea beer-mug wine-glass cocktail-glass pizza hamburger french-fries taco popcorn doughnut
  cookie cupcake soft-ice-cream pancakes green-salad steaming-bowl red-apple banana strawberry watermelon avocado
  chocolate-bar`,
  // Animals
  `dog-face cat-face rabbit-face fox bear panda tiger-face lion monkey-face frog chicken penguin baby-chick owl
  unicorn butterfly honeybee turtle octopus dolphin t-rex paw-prints`,
  // Weather and nature
  `sun sun-with-face sun-behind-cloud cloud cloud-with-rain cloud-with-lightning cloud-with-snow snowflake snowman
  rainbow umbrella-with-rain-drops droplet crescent-moon full-moon-face seedling four-leaf-clover sunflower rose
  tulip cherry-blossom cactus palm-tree`,
]
  .join(" ")
  .split(/\s+/)
  .filter(Boolean);

/** Writes graphics.json, stickers.json and LICENSES.md to `dir`, and says how many icons each set gave and lost. */
export async function writeLibrary(dir) {
  const lucide = await lucideIcons();
  const flat = await iconifySet("flat-color-icons");
  const brands = await iconifySet("simple-icons");
  const emoji = await iconifySet("fluent-emoji-flat");

  const graphics = [
    convert(lucide.set, lucide.icons),
    convert(flat.set, Object.keys(flat.data.icons).sort().map((id) => flat.icon(id))),
    // The brand set has no words of its own for its icons.
    convert(brands.set, BRANDS.map(([id, name]) => ({ ...brands.icon(id, name), tags: "brand logo" }))),
  ];
  const stickers = [convert(emoji.set, STICKERS.map((id) => emoji.icon(id)))];

  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/graphics.json`, library(graphics));
  await writeFile(`${dir}/stickers.json`, library(stickers));
  await writeFile(`${dir}/LICENSES.md`, licences([
    { ...lucide.set, file: "graphics.json", count: graphics[0].items.length, author: lucide.author, terms: lucide.licence },
    { ...flat.set, file: "graphics.json", count: graphics[1].items.length, author: flat.info.author.name, terms: mit(flat.info.author.name) },
    { ...brands.set, file: "graphics.json", count: graphics[2].items.length, author: brands.info.author.name, terms: CC0 },
    { ...emoji.set, file: "stickers.json", count: stickers[0].items.length, author: emoji.info.author.name, terms: mit(emoji.info.author.name) },
  ]));
  return [...graphics, ...stickers].map(({ set, items, skipped }) => ({ set: set.id, count: items.length, skipped }));
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function lucideIcons() {
  const dir = "node_modules/lucide-static";
  const pkg = await json(`${dir}/package.json`);
  const tags = await json(`${dir}/tags.json`);
  const files = (await readdir(`${dir}/icons`)).filter((file) => file.endsWith(".svg")).sort();
  const icons = await Promise.all(
    files.map(async (file) => {
      const id = file.slice(0, -".svg".length);
      const svg = await readFile(`${dir}/icons/${file}`, "utf8");
      return { id, name: plainName(id), tags: (tags[id] ?? []).join(" "), svg: () => svg };
    }),
  );
  const licence = await readFile(`${dir}/LICENSE`, "utf8");
  return { set: { id: "lucide", name: "Lucide", licence: pkg.license, source: pkg.homepage }, icons, author: "Lucide Icons and Contributors", licence };
}

async function iconifySet(prefix) {
  const dir = `node_modules/@iconify-json/${prefix}`;
  const [info, data, metadata, chars] = await Promise.all(["info", "icons", "metadata", "chars"].map((file) => json(`${dir}/${file}.json`)));
  const set = { id: prefix, name: info.name, licence: info.license.spdx, source: info.author.url };
  // Search words from the set's own metadata: the category an icon is filed under, and the emoji it stands for, so
  // typing a word or pasting the emoji finds it.
  const categories = new Map(Object.entries(metadata.categories ?? {}).flatMap(([category, ids]) => ids.map((id) => [id, category])));
  const codes = new Map(Object.entries(chars).map(([code, id]) => [id, code]));
  const tags = (id) => {
    const category = (categories.get(id) ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
    const code = codes.get(id);
    return [category, code && String.fromCodePoint(...code.split("-").map((hex) => parseInt(hex, 16)))].filter(Boolean).join(" ");
  };
  const icon = (id, name = plainName(id)) => ({ id, name, tags: tags(id), svg: () => iconifySvg(data, id) });
  return { set, info, data, icon };
}

/** An iconify icon as a whole SVG: its width and height (or the set's) and its offset become the viewBox. */
function iconifySvg(data, id) {
  const icon = resolve(data, id);
  if (!icon) throw new Unsupported("not in the set");
  if (icon.rotate) throw new Unsupported("transform");
  const [left, top] = [icon.left ?? data.left ?? 0, icon.top ?? data.top ?? 0];
  const [width, height] = [icon.width ?? data.width ?? 16, icon.height ?? data.height ?? 16];
  // A flip turns the drawing over about the middle of its own box.
  const flips = [
    icon.hFlip ? `translate(${2 * left + width} 0) scale(-1 1)` : "",
    icon.vFlip ? `translate(0 ${2 * top + height}) scale(1 -1)` : "",
  ].join(" ");
  const body = flips.trim() ? `<g transform="${flips}">${icon.body}</g>` : icon.body;
  return `<svg viewBox="${left} ${top} ${width} ${height}">${body}</svg>`;
}

/** An icon, or an alias of one, with the flips along the way added up. */
function resolve(data, id) {
  if (data.icons[id]) return data.icons[id];
  const alias = data.aliases?.[id];
  const parent = alias && resolve(data, alias.parent);
  if (!parent) return null;
  return {
    ...parent,
    ...alias,
    hFlip: !parent.hFlip !== !alias.hFlip,
    vFlip: !parent.vFlip !== !alias.vFlip,
    rotate: ((parent.rotate ?? 0) + (alias.rotate ?? 0)) % 4,
  };
}

function plainName(id) {
  return id.replace(/-/g, " ");
}

/** Each icon flattened to paths, or counted under the thing it used that paths can't hold. */
function convert(set, icons) {
  const items = [];
  const skipped = {};
  for (const icon of icons) {
    try {
      const art = svgToArt(icon.svg());
      if (!art.paths.length) throw new Unsupported("nothing drawn");
      items.push({ id: `${set.id}:${icon.id}`, set: set.id, name: icon.name, tags: icon.tags, art });
    } catch (error) {
      if (!(error instanceof Unsupported)) throw error;
      skipped[error.reason] = (skipped[error.reason] ?? 0) + 1;
    }
  }
  return { set, items, skipped };
}

function library(parts) {
  return JSON.stringify({ sets: parts.map((part) => part.set), items: parts.flatMap((part) => part.items) });
}

function licences(sets) {
  const sections = sets.map((set) =>
    [
      `## ${set.name}`,
      "",
      `- Licence: ${set.licence}`,
      `- Source: ${set.source}`,
      `- Author: ${set.author}`,
      `- In ${set.file}: ${set.count} drawings, converted from SVG to path data`,
      "",
      set.terms.trim(),
    ].join("\n"),
  );
  const intro = [
    "# Graphics and stickers",
    "",
    "The drawings in graphics.json and stickers.json come from the free icon sets below. Each icon was converted from",
    "SVG to plain path data when the app was built; its shapes and colours are the set's own.",
  ].join("\n");
  return `${[intro, ...sections].join("\n\n")}\n`;
}

const mit = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const CC0 = `CC0 1.0 Universal: the icons are dedicated to the public domain, and no notice is required.
The brand marks themselves remain trademarks of their owners. They are here so a clip can show where to listen or
follow, and showing one does not mean its owner endorses the clip.`;
