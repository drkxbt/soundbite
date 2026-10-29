import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const folder = new URL("../photos/", import.meta.url);
const photos = JSON.parse(readFileSync(new URL("photos.json", folder), "utf8"));

test("the library has forty-eight photos, each with its own id", () => {
  assert.equal(photos.length, 48);
  assert.equal(new Set(photos.map((photo) => photo.id)).size, photos.length);
});

test("every photo and its thumbnail is in the photos folder", () => {
  for (const photo of photos) {
    assert.ok(existsSync(new URL(photo.file, folder)), photo.file);
    assert.ok(existsSync(new URL(photo.thumb, folder)), photo.thumb);
  }
});

test("every photo is public domain, with who took it and where it came from", () => {
  for (const photo of photos) {
    assert.equal(photo.licence, "CC0", photo.id);
    assert.ok(photo.credit && photo.name, photo.id);
    assert.match(photo.source, /^https:\/\//, photo.id);
  }
});

test("each of the nine themes has five photos, and mist and atmosphere has eight", () => {
  const themes = Map.groupBy(photos, (photo) => photo.theme);
  assert.equal(themes.size, 9);
  for (const [theme, members] of themes) assert.equal(members.length, theme === "Mist and atmosphere" ? 8 : 5, theme);
});
