import { test } from "node:test";
import assert from "node:assert/strict";
import { thanksLinks } from "../dist/panel.js";

const base = { x: "drkxbt", repo: "https://github.com/drkxbt/soundbite" };

test("without a tip address the card asks only for a follow and a star", () => {
  assert.deepEqual(thanksLinks({ ...base, tip: "" }).map((link) => link.kind), ["follow", "star"]);
});

test("with a tip address the card offers a tip in crypto last, at that address", () => {
  const links = thanksLinks({ ...base, tip: "https://drk.vc/donate" });
  assert.deepEqual(links.map((link) => link.kind), ["follow", "star", "tip"]);
  assert.equal(links[2].href, "https://drk.vc/donate");
  assert.equal(links[2].text, "Tip in crypto");
  assert.equal(links[0].href, "https://x.com/intent/follow?screen_name=drkxbt");
});

test("a page's own path works as a tip address", () => {
  assert.equal(thanksLinks({ ...base, tip: "/donate" })[2].href, "/donate");
});

test("a tip address that isn't a web address is left out, never turned into a link", () => {
  for (const tip of ["javascript:alert(1)", "data:text/html,hi", "  "]) {
    assert.deepEqual(thanksLinks({ ...base, tip }).map((link) => link.kind), ["follow", "star"], tip);
  }
});
