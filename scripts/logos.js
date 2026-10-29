// The brand logos in the Elements panel, from Simple Icons: one path each in a 24 by 24 box, in the brand's colour.
// Written at build time so the editor reads one file from its own folder and never loads a logo from another host.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as icons from "simple-icons";

// The same checks kit.ts makes on a saved drawing, so a logo put in a design survives a reload.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const MOST_PATH = 20_000;
const HEX = /^[0-9a-f]{6}$/i;

/** Where a podcast clip sends people, in the order the panel shows them. */
export const FEATURED = [
  "x", "youtube", "tiktok", "instagram", "facebook", "spotify", "applepodcasts", "podcastaddict", "pocketcasts",
  "overcast", "castbox", "amazonmusic", "soundcloud", "twitch", "kick", "discord", "threads", "bluesky", "mastodon",
  "telegram", "whatsapp", "reddit", "linkedin", "substack", "patreon", "medium", "pinterest", "snapchat", "github",
];

// Simple Icons is CC0, but it records a licence of its own for some icons (GPL, CC BY-SA, non-commercial and
// others). Those are left out, so every logo shipped is CC0 and the licence file can say so without exceptions.
const isCC0 = (icon) => !icon.license || icon.license.type === "CC0-1.0";

const usable = (icon) =>
  isCC0(icon) && HEX.test(icon.hex) && icon.path.length <= MOST_PATH && PATH.test(icon.path) && /^[Mm]/.test(icon.path);

/** Writes outDir/logos.json and outDir/LICENSE.md, and says how many logos it kept and which featured ones it lacks. */
export async function writeLogos(outDir) {
  const kept = Object.values(icons)
    .filter(usable)
    .sort((a, b) => a.title.localeCompare(b.title, "en") || a.slug.localeCompare(b.slug, "en"));
  const bySlug = new Map(kept.map((icon) => [icon.slug, icon]));
  const featured = FEATURED.filter((slug) => bySlug.has(slug));
  const skipped = FEATURED.filter((slug) => !bySlug.has(slug));
  const logos = kept.map((icon) => ({ id: icon.slug, name: icon.title, hex: `#${icon.hex.toLowerCase()}`, path: icon.path }));

  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/logos.json`, JSON.stringify({ featured, logos }));
  await writeFile(`${outDir}/LICENSE.md`, licence(featured.map((slug) => bySlug.get(slug)), await version()));
  return { count: logos.length, skipped };
}

async function version() {
  const manifest = await readFile(new URL("../node_modules/simple-icons/package.json", import.meta.url), "utf8");
  return JSON.parse(manifest).version;
}

function licence(featured, release) {
  const guides = featured.filter((icon) => icon.guidelines).map((icon) => `- ${icon.title}: ${icon.guidelines}`);
  return [
    "# Logos",
    "",
    `The logos in logos.json come from Simple Icons (https://simpleicons.org), version ${release}, released under`,
    "CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/). Icons that Simple Icons lists under a",
    "licence of their own are not included.",
    "",
    "CC0 covers the drawings, not the brands. Each logo is a trademark of its owner, and using it must follow that",
    "owner's brand guidelines. Simple Icons links each brand's guidelines where it has them, at https://simpleicons.org.",
    "Showing a logo does not mean its owner endorses the clip or this project.",
    "",
    "Brand guidelines for the featured logos:",
    "",
    ...guides,
    "",
  ].join("\n");
}
