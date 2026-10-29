import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OBJECTS, writeObjects3d } from "../scripts/objects3d.js";
import { matchObjects, objects3dFeed, objectsPage, OBJECTS_PAGE, readObjects } from "../dist/objects3d.js";

let dir;
let written;
let index;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "soundbite-objects3d-"));
  written = await writeObjects3d(dir);
  index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
});
after(() => rm(dir, { recursive: true, force: true }));

test("the set keeps between 110 and 160 icons, each with its own id and file name", () => {
  assert.ok(OBJECTS.length >= 110 && OBJECTS.length <= 160, String(OBJECTS.length));
  assert.equal(new Set(OBJECTS.map(([id]) => id)).size, OBJECTS.length);
  assert.equal(new Set(OBJECTS.map(([id, , , from = id]) => from)).size, OBJECTS.length, "no render is used twice");
  for (const [id, name, tags] of OBJECTS) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
    assert.ok(name.trim(), id);
    assert.ok(tags.length >= 3 && tags.every((tag) => typeof tag === "string" && tag === tag.toLowerCase()), id);
  }
});

test("the index lists every icon written, in the set's order, with unique ids", () => {
  assert.equal(written.missing.length, 0, `could not fetch ${written.missing.join(", ")}`);
  assert.equal(index.length, OBJECTS.length);
  assert.deepEqual(index.map((entry) => entry.id), OBJECTS.map(([id]) => id));
  assert.equal(new Set(index.map((entry) => entry.id)).size, index.length);
  assert.deepEqual(Object.keys(index[0]), ["id", "name", "tags", "file", "width", "height"]);
});

test("every file in the index is there, a WebP of the size it says, and nothing else is", async () => {
  for (const entry of index) {
    const file = join(dir, entry.file);
    assert.ok(existsSync(file), entry.file);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", entry.file);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", entry.file);
    // An extended WebP (VP8X, which an alpha channel needs) keeps its canvas size, less one, in 24-bit fields.
    assert.equal(bytes.toString("ascii", 12, 16), "VP8X", `${entry.file} has a see-through background`);
    assert.ok(bytes[20] & 0x10, `${entry.file} carries alpha`);
    assert.equal(bytes.readUIntLE(24, 3) + 1, entry.width, entry.file);
    assert.equal(bytes.readUIntLE(27, 3) + 1, entry.height, entry.file);
    assert.ok(entry.width >= 256 && entry.width <= 512 && entry.height >= 256 && entry.height <= 512, entry.file);
  }
  const files = (await readdir(dir)).sort();
  assert.deepEqual(files, [...index.map((entry) => entry.file), "LICENSE.txt", "index.json"].sort());
});

test("the folder stays small enough to ship, and carries its licence", () => {
  const total = index.reduce((sum, entry) => sum + statSync(join(dir, entry.file)).size, 0);
  assert.ok(total < 12 * 1024 * 1024, `${total} bytes`);
  assert.equal(total, written.bytes);
  const licence = readFileSync(join(dir, "LICENSE.txt"), "utf8");
  assert.match(licence, /3dicons/);
  assert.match(licence, /CC0 1\.0/);
});

const entry = (id, name, tags) => ({ id, name, tags, file: `${id}.webp`, width: 400, height: 400 });
const sample = [
  entry("microphone", "Microphone", ["mic", "podcast", "voice"]),
  entry("headphones", "Headphones", ["listen", "podcast"]),
  entry("fire", "Fire", ["hot", "trending"]),
  entry("money-bag", "Money bag", ["money", "rich"]),
  entry("dollar-coin", "Dollar coin", ["money", "usd"]),
];
const ids = (entries) => entries.map((item) => item.id);
const base = new URL("https://drk.vc/soundbite/objects3d/");

test("a search finds icons by the start of a word in the name, a tag or the id, in the index's order", () => {
  assert.equal(matchObjects(sample, "  "), sample);
  assert.deepEqual(ids(matchObjects(sample, "pod")), ["microphone", "headphones"], "a tag");
  assert.deepEqual(ids(matchObjects(sample, "MIC")), ["microphone"], "any case");
  assert.deepEqual(ids(matchObjects(sample, "bag")), ["money-bag"], "a word of the name");
  assert.deepEqual(ids(matchObjects(sample, "money coin")), ["dollar-coin"], "every word has to match");
  assert.deepEqual(ids(matchObjects(sample, "icro")), [], "the middle of a word is not enough");
});

test("results come a page at a time, as stock items with their files next to the index", () => {
  const first = objectsPage(sample, "", 1, base, 2);
  assert.deepEqual(first.items.map((item) => item.id), ["3dicons-microphone", "3dicons-headphones"]);
  assert.equal(first.more, true);
  assert.deepEqual(first.items[0], {
    id: "3dicons-microphone",
    kind: "object3d",
    name: "Microphone",
    thumb: "https://drk.vc/soundbite/objects3d/microphone.webp",
    file: "https://drk.vc/soundbite/objects3d/microphone.webp",
    width: 400,
    height: 400,
  });
  const last = objectsPage(sample, "", 3, base, 2);
  assert.deepEqual(ids(last.items), ["3dicons-dollar-coin"]);
  assert.equal(last.more, false);
  assert.deepEqual(objectsPage(sample, "", 4, base, 2), { items: [], more: false });
  assert.deepEqual(objectsPage(sample, "money", 1, base, 1).more, true);
  assert.equal(objectsPage(sample, "", 1, base).items.length, sample.length, `${OBJECTS_PAGE} to a page`);
});

test("an index entry the editor couldn't use is dropped", () => {
  const good = entry("star", "Star", ["best"]);
  const read = readObjects([good, { ...good, file: "../secret.webp" }, { ...good, file: "https://elsewhere.example/a.webp" }, { ...good, width: 0 }, { ...good, tags: [1] }, null, "star"]);
  assert.deepEqual(read, [good]);
  assert.deepEqual(readObjects({ not: "a list" }), []);
});

test("the feed reads the bundled index once, offers it with no key, and credits 3dicons", async () => {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return new Response(JSON.stringify(index));
  };
  try {
    const feed = objects3dFeed(base);
    assert.equal(feed.kind, "object3d");
    assert.equal(feed.credit, "3D icons by 3dicons, CC0");
    assert.equal(feed.url, "https://3dicons.co/");
    const page = await feed.search("", 1);
    assert.equal(page.items.length, OBJECTS_PAGE);
    assert.equal(page.items[0].name, "Microphone");
    assert.equal(page.more, true);
    const rockets = await feed.search("rocket", 1);
    assert.deepEqual(rockets.items.map((item) => item.name), ["Rocket"]);
    const all = [];
    for (let at = 1; ; at++) {
      const next = await feed.search("", at);
      all.push(...next.items);
      if (!next.more) break;
    }
    assert.equal(all.length, index.length, "paging reaches every icon once");
    assert.deepEqual(asked, ["https://drk.vc/soundbite/objects3d/index.json"]);
  } finally {
    globalThis.fetch = real;
  }
});

test("a failed read of the index is asked for again on the next search", async () => {
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? new Response("", { status: 503 }) : new Response(JSON.stringify(sample)));
  try {
    const feed = objects3dFeed(base);
    await assert.rejects(feed.search("", 1));
    assert.equal((await feed.search("fire", 1)).items[0].name, "Fire");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = real;
  }
});
