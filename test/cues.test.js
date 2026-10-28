import { test } from "node:test";
import assert from "node:assert/strict";
import { isHallucination, mergeCues, toWords, wordsToCues } from "../dist/cues.js";

const words = (line, start = 0, step = 0.3) =>
  line.split(" ").map((text, i) => ({ text, start: start + i * step, end: start + i * step + 0.25 }));

test("Whisper's chunks become words in recording time, each with an end", () => {
  const chunks = [
    { text: " Welcome", timestamp: [0.5, 0.9] },
    { text: "  ", timestamp: [0.9, 1.0] },
    { text: " back", timestamp: [1.0, null] },
    { text: " now.", timestamp: [1.6, null] },
  ];
  assert.deepEqual(toWords(chunks, 12.5), [
    { text: "Welcome", start: 13, end: 13.4 },
    { text: "back", start: 13.5, end: 14.1 },
    { text: "now.", start: 14.1, end: 14.4 },
  ]);
});

test("a sentence stays whole up to 84 characters, since Audiogram pages long captions on screen itself", () => {
  const line = "Today we're talking about shipping in public.";
  assert.deepEqual(wordsToCues(words(line)).map((cue) => cue.text), [line]);
  const long = wordsToCues(words("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen"));
  assert.equal(long.length, 2);
  for (const cue of long) assert.ok(cue.text.length <= 84, cue.text);
});

test("no word runs past the end of the audio it was heard in", () => {
  const chunks = [{ text: " comes", timestamp: [1.5, 1.9] }, { text: " from.", timestamp: [1.98, 8.66] }];
  assert.deepEqual(toWords(chunks, 30, 3.16).map((word) => word.end), [31.9, 33.16]);
});

test("words group into captions that break at a chosen length", () => {
  const cues = wordsToCues(words("one two three four five six seven eight nine ten eleven twelve"), { maxChars: 42 });
  assert.ok(cues.length >= 2);
  for (const cue of cues) assert.ok(cue.text.length <= 42, cue.text);
  assert.equal(cues.map((cue) => cue.text).join(" "), "one two three four five six seven eight nine ten eleven twelve");
  assert.deepEqual(cues[0].words.map((word) => word.text), cues[0].text.split(" "));
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, cues[0].words.at(-1).end);
});

test("a pause over the gap starts a new caption", () => {
  const cues = wordsToCues([...words("so we shipped"), ...words("and then", 2)]);
  assert.deepEqual(cues.map((cue) => cue.text), ["so we shipped", "and then"]);
});

test("a question or a full stop ends its caption", () => {
  const cues = wordsToCues(words("did it work? yes it did. great"));
  assert.deepEqual(cues.map((cue) => cue.text), ["did it work?", "yes it did.", "great"]);
});

test("silence and Whisper's stock phrases count as no speech", () => {
  assert.equal(isHallucination([]), true);
  assert.equal(isHallucination(words("Thank you.")), true);
  assert.equal(isHallucination(words("Thanks for watching!")), true);
  assert.equal(isHallucination(words("you")), true);
  assert.equal(isHallucination(words("the the the the the the the")), true);
  assert.equal(isHallucination(words("Thank you for coming on the show today")), false);
  assert.equal(isHallucination(words("ship small and ship often")), false);
});

test("new captions replace only the ones inside the range they cover", () => {
  const existing = [
    { start: 0, end: 2, text: "before" },
    { start: 12, end: 14, text: "old" },
    { start: 19, end: 21, text: "straddles the end" },
    { start: 25, end: 27, text: "after" },
  ];
  const fresh = [{ start: 11, end: 13, text: "new" }];
  assert.deepEqual(mergeCues(existing, fresh, [10, 20]).map((cue) => cue.text), ["before", "new", "after"]);
  assert.deepEqual(mergeCues([], [], [0, 5]), []);
});
