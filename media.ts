/* Stock photos, illustrations, videos, stickers and GIFs from Pixabay, Pexels and GIPHY, and Google's Noto animated
   emoji, searched through the hosting site's own endpoint, which holds the sources' keys so none is ever in the page.
   A source the endpoint can't reach, or has no key for yet, is left out rather than shown empty.
   KLIPY's stickers and GIFs are the exception. Its terms have the visitor's browser ask KLIPY itself and load every
   file from the address KLIPY gives, with nothing in between, so its app key, public by design, is in the page.
   Free of the DOM, apart from fetch. */
import type { MediaFeed, MediaItem, MediaKind, MediaPage } from "@drkxbt/audiogram";

interface Source {
  source: string;
  name: string;
  url: string;
  credit: string;
  kinds: MediaKind[];
}

export const SOURCES: Source[] = [
  { source: "pixabay", name: "Pixabay", url: "https://pixabay.com/", credit: "Photos and videos from Pixabay", kinds: ["photo", "illustration", "vector", "video"] },
  { source: "pexels", name: "Pexels", url: "https://www.pexels.com/", credit: "Photos and videos from Pexels", kinds: ["photo", "video"] },
  { source: "noto", name: "Noto", url: "https://googlefonts.github.io/noto-emoji-animation/", credit: "Animated emoji from Google's Noto, CC BY 4.0", kinds: ["sticker"] },
  { source: "giphy", name: "GIPHY", url: "https://giphy.com/", credit: "Powered by GIPHY", kinds: ["sticker", "gif"] },
];

const KINDS: MediaKind[] = ["photo", "illustration", "vector", "video", "sticker", "object3d", "gif"];

/** An address from the endpoint, made whole against it; only http and https ones are kept. */
function address(value: unknown, base: URL): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** One page from the endpoint, every item checked: anything that isn't the shape the editor needs is dropped. */
export function readPage(body: unknown, kind: MediaKind, base: URL): MediaPage {
  const data = (body ?? {}) as { items?: unknown; more?: unknown };
  const items = (Array.isArray(data.items) ? data.items : []).flatMap((raw): MediaItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const thumb = address(item.thumb, base);
    const file = address(item.file, base);
    const width = Number(item.width);
    const height = Number(item.height);
    if (typeof item.id !== "string" || !thumb || !file || !(width > 0) || !(height > 0)) return [];
    const credit = item.credit as { name?: unknown; url?: unknown } | undefined;
    const creditUrl = address(credit?.url, base);
    return [{
      id: item.id.slice(0, 120),
      kind: KINDS.includes(item.kind as MediaKind) ? (item.kind as MediaKind) : kind,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 120) : "Untitled",
      thumb,
      file,
      width,
      height,
      ...(typeof credit?.name === "string" && credit.name && creditUrl ? { credit: { name: credit.name.slice(0, 80), url: creditUrl } } : {}),
      ...(address(item.link, base) ? { link: address(item.link, base)! } : {}),
    }];
  });
  return { items, more: data.more === true };
}

/** Every source and kind the endpoint at `endpoint` serves, as feeds the editor can search. */
export function mediaFeeds(endpoint: string, origin = globalThis.location?.href ?? "https://drk.vc/"): MediaFeed[] {
  const base = new URL(endpoint, origin);
  return SOURCES.flatMap((source) => source.kinds.map((kind): MediaFeed => ({
    kind,
    source: source.source,
    name: source.name,
    credit: source.credit,
    url: source.url,
    async search(query, page) {
      const url = new URL(base);
      url.search = new URLSearchParams({ source: source.source, kind, q: query.slice(0, 80), page: String(page) }).toString();
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${source.name} answered ${response.status}`);
      return readPage(await response.json(), kind, base);
    },
  })));
}

/**
 * The feeds of the libraries the endpoint has keys for. Asked with nothing, it answers `{ sources: [...] }`; an endpoint
 * that doesn't offers every library, and liveFeeds leaves out the ones that fail.
 */
export async function offeredFeeds(endpoint: string, origin = globalThis.location?.href ?? "https://drk.vc/"): Promise<MediaFeed[]> {
  const feeds = mediaFeeds(endpoint, origin);
  try {
    const response = await fetch(new URL(endpoint, origin), { headers: { Accept: "application/json" } });
    const { sources } = (await response.json()) as { sources?: unknown };
    if (response.ok && Array.isArray(sources)) return feeds.filter((feed) => sources.includes(feed.source));
  } catch {
    // Not a listing; every library gets asked.
  }
  return feeds;
}

/** The feeds that answer: each asked once for its first page, which the editor then has without asking again. */
export async function liveFeeds(feeds: MediaFeed[]): Promise<MediaFeed[]> {
  const answered = await Promise.all(feeds.map(async (feed) => {
    try {
      const first = await feed.search("", 1);
      // The first page is kept, so showing the section doesn't ask the source a second time.
      const search = feed.search.bind(feed);
      return [{ ...feed, search: (query: string, page: number) => (!query && page === 1 ? Promise.resolve(first) : search(query, page)) }];
    } catch {
      return [];
    }
  }));
  return answered.flat();
}

const KLIPY_API = "https://api.klipy.com/api/v1/";
const KLIPY_PATHS = { sticker: "stickers", gif: "gifs" } as const;
type KlipyKind = keyof typeof KLIPY_PATHS;
type Choice = [size: string, format: string];

const LARGE_FIRST = ["hd", "md", "sm", "xs"];
const SMALL_FIRST = ["sm", "xs", "md", "hd"];
const byFormat = (formats: string[]) => formats.flatMap((format) => LARGE_FIRST.map((size): Choice => [size, format]));
const bySize = (formats: string[]) => SMALL_FIRST.flatMap((size) => formats.map((format): Choice => [size, format]));
// The file goes on the picture, so the largest copy in the best format comes first: an animated WebP keeps a sticker's
// transparency, and an MP4, which the editor plays as a video layer, is far smaller than the same GIF. A thumbnail
// only fills a tile in the panel, so a small copy comes first, one that moves where KLIPY has it.
const RENDITIONS: Record<KlipyKind, { file: Choice[]; thumb: Choice[] }> = {
  sticker: { file: byFormat(["webp", "gif", "png"]), thumb: bySize(["webp", "png", "gif"]) },
  gif: { file: byFormat(["mp4", "webp", "gif"]), thumb: bySize(["webp", "gif", "jpg"]) },
};

const field = (value: unknown, name: string): unknown => (value && typeof value === "object" ? (value as Record<string, unknown>)[name] : undefined);

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** The first of `choices` KLIPY offers with an https address and a size. The address is kept exactly as KLIPY gave
 *  it, since its terms ask that nothing in it is changed. */
function rendition(files: unknown, choices: Choice[]): { url: string; width: number; height: number } | null {
  for (const [size, format] of choices) {
    const entry = field(field(files, size), format);
    const url = field(entry, "url");
    const width = Number(field(entry, "width"));
    const height = Number(field(entry, "height"));
    if (typeof url === "string" && isHttps(url) && width > 0 && height > 0) return { url, width, height };
  }
  return null;
}

/** KLIPY's id for an item, or its slug when the id is too large to have come through JSON intact. */
function klipyId(item: unknown): string | null {
  const id = field(item, "id");
  if (typeof id === "string" && id) return id;
  if (Number.isSafeInteger(id)) return String(id);
  const slug = field(item, "slug");
  return typeof slug === "string" && slug ? slug : null;
}

/**
 * One page of a KLIPY search or trending list, in KLIPY's order. Its terms ask that results are shown as they come, so
 * the only items left out are ones with nothing that can be drawn, and ads: ads are off on drk.vc's key, and one shown
 * as a sticker would pass for something it isn't.
 */
export function readKlipyPage(body: unknown, kind: KlipyKind): MediaPage {
  const page = field(body, "data");
  const list = field(page, "data");
  const items = (Array.isArray(list) ? list : []).flatMap((raw): MediaItem[] => {
    if (!raw || typeof raw !== "object" || field(raw, "type") === "ad") return [];
    const file = rendition(field(raw, "file"), RENDITIONS[kind].file);
    const thumb = rendition(field(raw, "file"), RENDITIONS[kind].thumb);
    if (!file || !thumb) return [];
    const title = field(raw, "title");
    const name = typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    return [{
      id: `klipy-${kind}-${klipyId(raw) ?? file.url}`,
      kind,
      name: name || (kind === "sticker" ? "Sticker" : "GIF"),
      thumb: thumb.url,
      file: file.url,
      width: file.width,
      height: file.height,
    }];
  });
  return { items, more: field(page, "has_next") === true };
}

/** KLIPY's stickers and GIFs, searched from this browser with the app key `key`. */
export function klipyFeeds(key: string): MediaFeed[] {
  return (Object.keys(KLIPY_PATHS) as KlipyKind[]).map((kind): MediaFeed => ({
    kind,
    source: "klipy",
    name: "KLIPY",
    credit: "Powered by KLIPY",
    url: "https://klipy.com/",
    // KLIPY's one required attribution.
    placeholder: "Search KLIPY",
    async search(query, page) {
      const words = query.replace(/\s+/g, " ").trim().slice(0, 80);
      const url = new URL(`${encodeURIComponent(key)}/${KLIPY_PATHS[kind]}/${words ? "search" : "trending"}`, KLIPY_API);
      // No customer_id, so KLIPY is told nothing that tells one visitor from another.
      url.search = new URLSearchParams({ page: String(page), per_page: "30", ...(words ? { q: words } : {}), content_filter: "high" }).toString();
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`KLIPY answered ${response.status}`);
      const body: unknown = await response.json();
      if (field(body, "result") === false) throw new Error("KLIPY turned the search down");
      return readKlipyPage(body, kind);
    },
  }));
}

/**
 * KLIPY's feeds, when the endpoint at `endpoint` hands out an app key as `{ key }`; none when it has no key or can't
 * be reached. Unlike the stock feeds they aren't asked for a first page to see whether they answer, since a key still
 * in testing allows only 100 requests an hour.
 */
export async function offeredKlipyFeeds(endpoint: string, origin = globalThis.location?.href ?? "https://drk.vc/"): Promise<MediaFeed[]> {
  try {
    const response = await fetch(new URL(endpoint, origin), { headers: { Accept: "application/json" } });
    const key = field(await response.json(), "key");
    if (response.ok && typeof key === "string" && key.trim()) return klipyFeeds(key.trim());
  } catch {
    // No key, so no KLIPY.
  }
  return [];
}
