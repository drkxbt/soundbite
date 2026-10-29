import { test } from "node:test";
import assert from "node:assert/strict";
import { keepable } from "../dist/pictures.js";

test("KLIPY's stickers and GIFs are not kept between visits, as KLIPY's terms ask; every other picture is", () => {
  const blob = new Blob(["x"]);
  const kept = keepable({ background: blob, "photo-1": "data:image/png;base64,AA", "stock-pixabay-photo-1": blob, "stock-klipy-sticker-9": blob, "stock-klipy-gif-3": blob });
  assert.deepEqual(Object.keys(kept), ["background", "photo-1", "stock-pixabay-photo-1"]);
});
