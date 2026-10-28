import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKit } from "../dist/kit.js";

test("nothing saved, or something unreadable, is an empty kit", () => {
  assert.deepEqual(parseKit(null), {});
  assert.deepEqual(parseKit("{not json"), {});
  assert.deepEqual(parseKit("[1,2]"), {});
  assert.deepEqual(parseKit('"text"'), {});
});

test("fields of the wrong kind are dropped, the rest kept", () => {
  assert.deepEqual(parseKit(JSON.stringify({ layout: "wide", theme: "2" })), {});
  assert.deepEqual(parseKit(JSON.stringify({ visual: "sparkles", theme: -1, cover: "https://example.com/a.png", title: 5 })), {});
  assert.deepEqual(parseKit(JSON.stringify({ speaker: "drk", theme: 1.5 })), { speaker: "drk" });
});

test("a kit saved by Soundbite reads back the same", () => {
  const kit = { title: "Shipping in public", speaker: "drk", handle: "@drkxbt", layout: "portrait", visual: "wave", theme: 2, cover: "data:image/jpeg;base64,/9j/4AAQ" };
  assert.deepEqual(parseKit(JSON.stringify(kit)), kit);
});
