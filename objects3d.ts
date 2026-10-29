/* The 3D section's source: 3dicons by Vijay Verma, given to the public domain (CC0), bundled next to the app by the
   build (scripts/objects3d.js). Searching it reads only the app's own index, so it needs no key and no other host.
   Free of the DOM, apart from fetch. */
import type { MediaFeed, MediaItem, MediaPage } from "@drkxbt/audiogram";

/** One icon as objects3d/index.json lists it. */
export interface Object3dEntry {
  id: string;
  name: string;
  tags: string[];
  file: string;
  width: number;
  height: number;
}

// As many to a page as the stock sources give, so See all fills the same way.
export const OBJECTS_PAGE = 30;

/** The icons a search finds, in the index's order: every word typed has to start a word of the name, a tag or the id,
 *  as the editor's own sets are searched. */
export function matchObjects(entries: Object3dEntry[], query: string): Object3dEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((entry) => {
    const own = [...entry.name.toLowerCase().split(/[^\p{L}\p{N}]+/u), ...entry.tags.map((tag) => tag.toLowerCase()), ...entry.id.split("-")].filter(Boolean);
    return words.every((word) => own.some((part) => part.startsWith(word)));
  });
}

/** One page of what a search finds, counted from 1, each icon as the editor's stock items are, its file next to the
 *  index at `base`. */
export function objectsPage(entries: Object3dEntry[], query: string, page: number, base: URL, size = OBJECTS_PAGE): MediaPage {
  const found = matchObjects(entries, query);
  const from = (Math.max(1, Math.floor(page)) - 1) * size;
  const items = found.slice(from, from + size).map((entry): MediaItem => {
    const file = new URL(entry.file, base).href;
    return { id: `3dicons-${entry.id}`, kind: "object3d", name: entry.name, thumb: file, file, width: entry.width, height: entry.height };
  });
  return { items, more: from + size < found.length };
}

/** The index, checked: an entry missing a field the editor needs, or with a file outside the folder, is dropped. */
export function readObjects(body: unknown): Object3dEntry[] {
  return (Array.isArray(body) ? body : []).filter((raw): raw is Object3dEntry => {
    const entry = raw as Partial<Object3dEntry> | null;
    return Boolean(entry) && typeof entry!.id === "string" && typeof entry!.name === "string" && Array.isArray(entry!.tags)
      && entry!.tags.every((tag) => typeof tag === "string") && typeof entry!.file === "string" && /^[a-z0-9-]+\.webp$/.test(entry!.file)
      && Number(entry!.width) > 0 && Number(entry!.height) > 0;
  });
}

/** The bundled 3D icons in the folder at `base`, as a source for the editor's 3D section. The index is read the first
 *  time the section asks, and again after a failed read. */
export function objects3dFeed(base: URL): MediaFeed {
  let index: Promise<Object3dEntry[]> | null = null;
  const load = () => {
    index ??= fetch(new URL("index.json", base))
      .then((response) => {
        if (!response.ok) throw new Error(`The 3D icons answered ${response.status}`);
        return response.json();
      })
      .then(readObjects);
    index.catch(() => (index = null));
    return index;
  };
  return {
    kind: "object3d",
    source: "3dicons",
    name: "3dicons",
    credit: "3D icons by 3dicons, CC0",
    url: "https://3dicons.co/",
    async search(query, page) {
      return objectsPage(await load(), query, page, base);
    },
  };
}
