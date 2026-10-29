import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FEATURED, writeLogos } from "../scripts/logos.js";

// kit.ts drops a saved path that fails these, so a logo that failed them would vanish from a design on reload.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;

let dir;
let result;
let library;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "soundbite-logos-"));
  result = await writeLogos(dir);
  library = JSON.parse(readFileSync(join(dir, "logos.json"), "utf8"));
});
after(() => rm(dir, { recursive: true, force: true }));

test("the library holds every logo it reports, sorted by name", () => {
  assert.ok(library.logos.length > 1000, `${library.logos.length} logos`);
  assert.equal(result.count, library.logos.length);
  const names = library.logos.map((logo) => logo.name);
  assert.deepEqual(names, names.toSorted((a, b) => a.localeCompare(b, "en")));
});

test("every logo is one path a saved design keeps", () => {
  for (const logo of library.logos) {
    assert.ok(logo.path.length <= 20000, logo.id);
    assert.match(logo.path, PATH, logo.id);
    assert.match(logo.path, /^[Mm]/, logo.id);
    assert.ok(logo.name, logo.id);
  }
});

test("each logo has its own id and a #rrggbb colour", () => {
  assert.equal(new Set(library.logos.map((logo) => logo.id)).size, library.logos.length);
  for (const logo of library.logos) assert.match(logo.hex, /^#[0-9a-f]{6}$/, logo.id);
});

test("the featured platforms are in the library, in order, the big ones among them", () => {
  const ids = new Set(library.logos.map((logo) => logo.id));
  for (const id of library.featured) assert.ok(ids.has(id), id);
  assert.deepEqual(library.featured, FEATURED.filter((id) => !result.skipped.includes(id)));
  for (const id of ["x", "youtube", "tiktok", "instagram", "spotify"]) assert.ok(library.featured.includes(id), id);
});

test("the licence file names the source and the owners' rights", () => {
  assert.ok(existsSync(join(dir, "LICENSE.md")));
  const licence = readFileSync(join(dir, "LICENSE.md"), "utf8");
  assert.match(licence, /Simple Icons/);
  assert.match(licence, /CC0 1\.0/);
  assert.match(licence, /simpleicons\.org/);
  assert.match(licence, /brand guidelines/);
});
