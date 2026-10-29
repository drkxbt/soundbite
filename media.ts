/* Stock photos, illustrations, videos, stickers and GIFs from Pixabay, Pexels and GIPHY, searched through the hosting
   site's own endpoint, which holds the sources' keys so none is ever in the page. A source the endpoint can't reach,
   or has no key for yet, is left out rather than shown empty. Free of the DOM, apart from fetch. */
import type { MediaFeed, MediaItem, MediaKind, MediaPage } from "@drkxbt/audiogram";

interface Source {
  source: string;
  name: string;
  url: string;
  credit: string;
  kinds: MediaKind[];
}

export const SOURCES: Source[] = [
  { source: "pixabay", name: "Pixabay", url: "https://pixabay.com/", credit: "Photos and videos from Pixabay", kinds: ["photo", "illustration", "video"] },
  { source: "pexels", name: "Pexels", url: "https://www.pexels.com/", credit: "Photos and videos from Pexels", kinds: ["photo", "video"] },
  { source: "giphy", name: "GIPHY", url: "https://giphy.com/", credit: "Powered by GIPHY", kinds: ["sticker", "gif"] },
];

const KINDS: MediaKind[] = ["photo", "illustration", "video", "sticker", "gif"];

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
