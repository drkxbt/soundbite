import { test } from "node:test";
import assert from "node:assert/strict";
import { klipyFeeds, liveFeeds, mediaFeeds, offeredFeeds, offeredKlipyFeeds, readKlipyPage, readPage, SOURCES } from "../dist/media.js";

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

test("Noto's animated emoji are a sticker feed of their own, credited to Noto and listed before GIPHY's", async () => {
  const feeds = mediaFeeds("/api/media", "https://drk.vc/engines/soundbite");
  assert.deepEqual(feeds.filter((feed) => feed.kind === "sticker").map((feed) => feed.source), ["noto", "giphy"]);
  const noto = feeds.filter((feed) => feed.source === "noto");
  assert.equal(noto.length, 1);
  assert.equal(noto[0].name, "Noto");
  assert.equal(noto[0].credit, "Animated emoji from Google's Noto, CC BY 4.0");
  assert.equal(noto[0].url, "https://googlefonts.github.io/noto-emoji-animation/");
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return new Response(JSON.stringify({
      more: false,
      items: [{ id: "noto-sticker-1f525", kind: "sticker", name: "Fire", thumb: "/api/media-file?url=png", file: "/api/media-file?url=webp", width: 512, height: 512, link: "https://googlefonts.github.io/noto-emoji-animation/" }],
    }), { status: 200 });
  };
  const page = await noto[0].search("fire", 1);
  assert.equal(asked[0], "https://drk.vc/api/media?source=noto&kind=sticker&q=fire&page=1");
  assert.equal(page.items[0].file, "https://drk.vc/api/media-file?url=webp");
  assert.equal("credit" in page.items[0], false, "the feed's own line credits Noto");
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
  assert.equal(live.length, 7, "pixabay's four, noto's one and giphy's two");
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
    return new Response(JSON.stringify({ sources: ["noto", "giphy"] }), { status: 200 });
  };
  const offered = await offeredFeeds("/api/media", "https://drk.vc/engines/soundbite");
  assert.deepEqual(asked, ["https://drk.vc/api/media"]);
  assert.deepEqual(offered.map((feed) => `${feed.source} ${feed.kind}`), ["noto sticker", "giphy sticker", "giphy gif"]);

  globalThis.fetch = async () => new Response("not json", { status: 404 });
  assert.equal((await offeredFeeds("/api/media", "https://drk.vc/")).length, mediaFeeds("/api/media", "https://drk.vc/").length);

  globalThis.fetch = async () => new Response(JSON.stringify({ sources: [] }), { status: 200 });
  assert.deepEqual(await offeredFeeds("/api/media", "https://drk.vc/"), []);
});

// KLIPY's documented answers (docs.klipy.com, Sticker - Trending API and GIF Format Sizes), less the blur previews.
const KLIPY_FILES = "https://static.klipy.com/ii/";
const at = (path, width, height, size) => ({ url: KLIPY_FILES + path, width, height, size });
const STICKER = {
  id: 6914457558367152,
  slug: "grrr-rawr-sticker",
  title: "Grrr Rawr Sticker",
  file: {
    hd: { gif: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/5LM0jRpL.gif", 189, 200, 19826), webp: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/ymgvNqpC.webp", 189, 200, 16260), webm: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/cELgpYLY2vAMchu.webm", 189, 200, 46014), png: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/Ob37L1ulsJbqLSejGIq.png", 189, 200, 3178) },
    md: { gif: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/Banizfo4.gif", 189, 200, 19826), webp: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/SG2K9FPA.webp", 189, 200, 23404), webm: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/VGAfuM3Sg2DPdTJfr.webm", 189, 200, 46014), png: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/EbFve6y2zRQr.png", 189, 200, 3178) },
    sm: { gif: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/y1i7SXbN.gif", 189, 200, 19826), webp: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/wGlFlJ2s.webp", 189, 200, 16260), webm: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/riuZaQVF7B2GxXf01e.webm", 189, 200, 46014), png: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/KX4PsBURNDPcgZSp.png", 189, 200, 3178) },
    xs: { gif: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/3kIBz7en.gif", 85, 90, 6123), webp: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/JkvfVjBd.webp", 86, 90, 10074), webm: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/32CN4xeqzOIKReoi.webm", 85, 90, 17283), png: at("ffd4ac143e6335ac68951b787d3c1902/e8/3a/pPW0lm1SPTInPR.png", 85, 90, 1091) },
  },
  tags: [],
  type: "sticker",
};
const GIF = {
  id: 8041071659142944,
  slug: "hello-hi-662",
  title: "Hello",
  file: {
    hd: { gif: at("935d7ab9d8c6202580a668421940ec81/14/af/um0L4dFH.gif", 498, 498, 4001918), webp: at("935d7ab9d8c6202580a668421940ec81/14/af/eUbp2uNc.webp", 498, 498, 285228), jpg: at("935d7ab9d8c6202580a668421940ec81/14/af/LyWpim71.jpg", 498, 498, 19255), mp4: at("935d7ab9d8c6202580a668421940ec81/14/af/MCCBoQlZ.mp4", 498, 498, 119294), webm: at("935d7ab9d8c6202580a668421940ec81/14/af/KkjHgST0WkvqPhrQBEj.webm", 498, 498, 79936) },
    md: { gif: at("935d7ab9d8c6202580a668421940ec81/14/af/8GCrVAB7.gif", 498, 498, 3721260), webp: at("935d7ab9d8c6202580a668421940ec81/14/af/JUYsGsrc.webp", 498, 498, 643490), jpg: at("935d7ab9d8c6202580a668421940ec81/14/af/UsX8Vqtm.jpg", 498, 498, 20086), mp4: at("935d7ab9d8c6202580a668421940ec81/14/af/V6da8Awi.mp4", 498, 498, 119294), webm: at("935d7ab9d8c6202580a668421940ec81/14/af/KYvHAODcgRYMmD.webm", 498, 498, 79936) },
    sm: { gif: at("935d7ab9d8c6202580a668421940ec81/14/af/y6iepZM7.gif", 220, 220, 314884), webp: at("935d7ab9d8c6202580a668421940ec81/14/af/SE72470w.webp", 220, 220, 80118), jpg: at("935d7ab9d8c6202580a668421940ec81/14/af/uvntdY4w.jpg", 220, 220, 8560), mp4: at("935d7ab9d8c6202580a668421940ec81/14/af/3c2Tqd1S.mp4", 320, 320, 49565), webm: at("935d7ab9d8c6202580a668421940ec81/14/af/E4zwjSqD1BNoXKAEm1UE.webm", 320, 320, 48827) },
    xs: { gif: at("935d7ab9d8c6202580a668421940ec81/14/af/A4bPjSsj.gif", 90, 90, 71468), webp: at("935d7ab9d8c6202580a668421940ec81/14/af/Sp4pln3Z.webp", 90, 90, 25340), jpg: at("935d7ab9d8c6202580a668421940ec81/14/af/cGfi4U83.jpg", 90, 90, 2949), mp4: at("935d7ab9d8c6202580a668421940ec81/14/af/La0HaAzw.mp4", 150, 150, 20257), webm: at("935d7ab9d8c6202580a668421940ec81/14/af/45Vik66JyFsr7B6NrYM.webm", 150, 150, 38333) },
  },
  tags: [],
  type: "gif",
};
const klipyAnswer = (items, hasNext = true) => ({ result: true, data: { data: items, current_page: 1, per_page: 24, has_next: hasNext } });

test("a KLIPY sticker goes on the picture as its animated WebP, with a small WebP in the panel", () => {
  const page = readKlipyPage(klipyAnswer([STICKER]), "sticker");
  assert.equal(page.more, true);
  assert.deepEqual(page.items, [{
    id: "klipy-sticker-6914457558367152",
    kind: "sticker",
    name: "Grrr Rawr Sticker",
    thumb: STICKER.file.sm.webp.url,
    file: STICKER.file.hd.webp.url,
    width: 189,
    height: 200,
  }]);
});

test("a KLIPY GIF goes on the picture as its MP4, and as a WebP or a GIF where KLIPY has no MP4", () => {
  const [gif] = readKlipyPage(klipyAnswer([GIF], false), "gif").items;
  assert.equal(gif.id, "klipy-gif-8041071659142944");
  assert.equal(gif.file, GIF.file.hd.mp4.url);
  assert.equal(gif.thumb, GIF.file.sm.webp.url);
  assert.deepEqual([gif.width, gif.height], [498, 498]);
  assert.equal(readKlipyPage(klipyAnswer([GIF], false), "gif").more, false);

  const noMp4 = { ...GIF, file: Object.fromEntries(Object.entries(GIF.file).map(([size, formats]) => [size, { ...formats, mp4: undefined }])) };
  assert.equal(readKlipyPage(klipyAnswer([noMp4]), "gif").items[0].file, GIF.file.hd.webp.url);
  const gifOnly = { ...GIF, file: { hd: { gif: GIF.file.hd.gif }, xs: { jpg: GIF.file.xs.jpg } } };
  const [plain] = readKlipyPage(klipyAnswer([gifOnly]), "gif").items;
  assert.equal(plain.file, GIF.file.hd.gif.url);
  assert.equal(plain.thumb, GIF.file.xs.jpg.url);
});

test("KLIPY's results keep their order and addresses, and only ads and items with nothing to draw are left out", () => {
  const odd = "https://static2.klipy.com/ii/a/b/Mixed%20Case.webp?token=AbC&x=1";
  const items = [
    { ...STICKER, id: 1, title: "  First \n one " },
    { ...STICKER, id: 2, type: "ad" },
    { ...STICKER, id: 3, file: { hd: { webp: { url: "http://static.klipy.com/a.webp", width: 10, height: 10 } } } },
    { ...STICKER, id: 4, file: { hd: { webp: { url: odd, width: 40, height: 20 } } } },
    { ...STICKER, id: 5, file: { hd: { webm: STICKER.file.hd.webm } } },
    { ...STICKER, id: 6, file: { hd: { png: { ...STICKER.file.hd.png, width: 0 } } } },
    { ...STICKER, id: 2 ** 60, title: "" },
    null,
    "not an item",
  ];
  const page = readKlipyPage(klipyAnswer(items), "sticker");
  assert.deepEqual(page.items.map((item) => item.id), ["klipy-sticker-1", "klipy-sticker-4", "klipy-sticker-grrr-rawr-sticker"]);
  assert.equal(page.items[0].name, "First one");
  assert.equal(page.items[1].file, odd, "the address is kept exactly as KLIPY gave it");
  assert.equal(page.items[1].thumb, odd);
  assert.deepEqual([page.items[1].width, page.items[1].height], [40, 20]);
  assert.equal(page.items[2].name, "Sticker");
  assert.deepEqual(readKlipyPage({ result: false }, "gif"), { items: [], more: false });
  assert.deepEqual(readKlipyPage(null, "sticker"), { items: [], more: false });
});

test("KLIPY is asked from the browser for trending or a search, thirty at a time, with nothing about the visitor", async () => {
  const feeds = klipyFeeds("key-123");
  assert.deepEqual(feeds.map((feed) => feed.kind), ["sticker", "gif"]);
  for (const feed of feeds) {
    assert.equal(feed.source, "klipy");
    assert.equal(feed.name, "KLIPY");
    assert.equal(feed.credit, "Powered by KLIPY");
    assert.equal(feed.url, "https://klipy.com/");
    assert.equal(feed.placeholder, "Search KLIPY");
  }
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return Response.json(klipyAnswer([String(url).includes("/gifs/") ? GIF : STICKER]));
  };
  const trending = await feeds[0].search("", 1);
  assert.equal(trending.items[0].id, "klipy-sticker-6914457558367152");
  await feeds[1].search("  good   morning ", 3);
  assert.deepEqual(asked, [
    "https://api.klipy.com/api/v1/key-123/stickers/trending?page=1&per_page=30&content_filter=high",
    "https://api.klipy.com/api/v1/key-123/gifs/search?page=3&per_page=30&q=good+morning&content_filter=high",
  ]);
  assert.ok(asked.every((url) => !url.includes("customer_id")));

  globalThis.fetch = async () => Response.json({ result: false, errors: { message: "Invalid key" } }, { status: 401 });
  await assert.rejects(feeds[0].search("", 1), /401/);
  globalThis.fetch = async () => Response.json({ result: false }, { status: 200 });
  await assert.rejects(feeds[1].search("cat", 1));
});

test("KLIPY is offered only when the hosting page hands out a key, and isn't asked for anything until it is shown", async () => {
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return Response.json({ key: " key-123 " });
  };
  const feeds = await offeredKlipyFeeds("/api/klipy", "https://drk.vc/engines/soundbite");
  assert.deepEqual(asked, ["https://drk.vc/api/klipy"]);
  assert.deepEqual(feeds.map((feed) => `${feed.source} ${feed.kind}`), ["klipy sticker", "klipy gif"]);
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    return Response.json(klipyAnswer([]));
  };
  await feeds[0].search("", 1);
  assert.equal(asked[1], "https://api.klipy.com/api/v1/key-123/stickers/trending?page=1&per_page=30&content_filter=high");

  globalThis.fetch = async () => Response.json({ error: "not-configured" }, { status: 404 });
  assert.deepEqual(await offeredKlipyFeeds("/api/klipy", "https://drk.vc/"), []);
  globalThis.fetch = async () => Response.json({ key: "" });
  assert.deepEqual(await offeredKlipyFeeds("/api/klipy", "https://drk.vc/"), []);
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.deepEqual(await offeredKlipyFeeds("/api/klipy", "https://drk.vc/"), []);
});
