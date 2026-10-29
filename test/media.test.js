import { test } from "node:test";
import assert from "node:assert/strict";
import { liveFeeds, mediaFeeds, offeredFeeds, readPage, SOURCES } from "../dist/media.js";

const base = new URL("https://drk.vc/api/media");

test("a page from the endpoint keeps sound items, makes their addresses whole and drops the rest", () => {
  const page = readPage({
    more: true,
    items: [
      { id: "pixabay-photo-1", kind: "photo", name: "Studio microphone", thumb: "https://cdn.pixabay.com/a_340.jpg", file: "/api/media-file?url=x", width: 1920, height: 1280, credit: { name: "Ana", url: "https://pixabay.com/users/ana-1/" }, link: "https://pixabay.com/photos/1/" },
      { id: "no-size", thumb: "https://x/a.jpg", file: "https://x/a.jpg", width: 0, height: 10 },
      { id: "bad-scheme", thumb: "javascript:alert(1)", file: "https://x/a.jpg", width: 10, height: 10 },
      { id: 7, thumb: "https://x/a.jpg", file: "https://x/a.jpg", width: 10, height: 10 },
      "not an item",
    ],
  }, "photo", base);
  assert.equal(page.more, true);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].file, "https://drk.vc/api/media-file?url=x");
  assert.equal(page.items[0].credit.name, "Ana");
  assert.deepEqual(readPage(null, "gif", base), { items: [], more: false });
});

test("every source and kind becomes a feed that asks the endpoint for it", async () => {
  const feeds = mediaFeeds("/api/media", "https://drk.vc/engines/soundbite");
  assert.equal(feeds.length, SOURCES.reduce((sum, source) => sum + source.kinds.length, 0));
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return new Response(JSON.stringify({ items: [], more: false }), { status: 200 });
  };
  await feeds.find((feed) => feed.source === "giphy" && feed.kind === "sticker").search("mic", 2);
  assert.equal(asked[0], "https://drk.vc/api/media?source=giphy&kind=sticker&q=mic&page=2");
});

test("a source with no key yet is left out, and an answering one isn't asked for its first page twice", async () => {
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    const source = new URL(url).searchParams.get("source");
    if (source === "pexels") return new Response(JSON.stringify({ error: "not-configured" }), { status: 503 });
    return new Response(JSON.stringify({ items: [{ id: `${source}-1`, thumb: "https://x/t.jpg", file: "https://x/f.jpg", width: 10, height: 10 }], more: true }), { status: 200 });
  };
  const live = await liveFeeds(mediaFeeds("/api/media", "https://drk.vc/"));
  assert.ok(live.every((feed) => feed.source !== "pexels"));
  assert.equal(live.length, 6, "pixabay's four and giphy's two");
  const before = calls;
  const first = await live[0].search("", 1);
  assert.equal(first.items.length, 1);
  assert.equal(calls, before, "the first page was kept");
  await live[0].search("", 2);
  assert.equal(calls, before + 1);
});

test("only the libraries the endpoint names are offered, and an endpoint that names none of them offers every one", async () => {
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return new Response(JSON.stringify({ sources: ["giphy"] }), { status: 200 });
  };
  const offered = await offeredFeeds("/api/media", "https://drk.vc/engines/soundbite");
  assert.deepEqual(asked, ["https://drk.vc/api/media"]);
  assert.deepEqual(offered.map((feed) => `${feed.source} ${feed.kind}`), ["giphy sticker", "giphy gif"]);

  globalThis.fetch = async () => new Response("not json", { status: 404 });
  assert.equal((await offeredFeeds("/api/media", "https://drk.vc/")).length, mediaFeeds("/api/media", "https://drk.vc/").length);

  globalThis.fetch = async () => new Response(JSON.stringify({ sources: [] }), { status: 200 });
  assert.deepEqual(await offeredFeeds("/api/media", "https://drk.vc/"), []);
});
