import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { TRACKS } from "../dist/music.js";

test("the free music: four tracks, each with a name, a mood and its own .m4a beside the app", () => {
  assert.equal(TRACKS.length, 4);
  assert.equal(new Set(TRACKS.map((track) => track.id)).size, 4);
  for (const track of TRACKS) {
    assert.ok(track.name && track.mood, track.id);
    const file = `music/${track.id}.m4a`;
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size > 100_000, `${file} holds a minute of sound`);
  }
});
