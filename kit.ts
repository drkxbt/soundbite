import type { Art, Layer, Layout, Page, Settings, Visual } from "@drkxbt/audiogram";

/** The look a user keeps between clips: Audiogram's settings, with each picture shrunk to a data URL. */
export type Kit = Partial<Pick<Settings, "title" | "speaker" | "handle" | "layout" | "visual" | "links">> & {
  theme?: number;
  cover?: string;
  background?: string;
  /** The music's level; the music itself is too big to keep and is opened again each visit. */
  musicVolume?: number;
  /** The layout the user made for each shape they changed; their uploaded pictures are kept apart, by key. */
  layers?: Partial<Record<Layout, Layer[]>>;
  /** The page's own colour, or null for the theme's; missing in a kit from before pages had one. */
  page?: Page | null;
  /** The Elements added lately, newest first, by the editor's own names for them. */
  recent?: string[];
};

const KINDS = new Set(["avatar", "name", "handle", "title", "visual", "time", "captions", "links", "text", "image", "video", "shape", "graphic", "chart", "table", "mockup", "solid", "ambient"]);
const SHAPES = [
  "rect", "ellipse", "triangle", "star", "heart", "arrow", "diamond", "bubble", "pentagon", "hexagon", "octagon", "cross", "parallelogram", "arch", "line",
  "burst", "sparkle", "squircle", "blob", "ring", "quote", "banner", "tag", "chevron", "cloud", "moon", "check",
];
const ENTRANCES = [
  "fade", "rise", "pan", "slide", "pop", "wipe", "blur", "zoom", "breathe", "baseline", "drift", "tumble", "stomp", "bounce", "flicker", "typewriter",
  "ascend", "shift", "merge", "burst", "cascade", "spread", "block", "clarify", "glide", "roll", "skate", "elastic", "flip", "unfold", "iris", "curtain", "fall", "tectonic", "scrapbook", "shine", "grow",
];
const LOOPS = ["pulse", "wiggle", "rotate", "float", "sway", "heartbeat", "shimmer", "flash", "slowZoom"];
const DIRECTIONS = ["up", "down", "left", "right"];
const CHARTS = ["column", "bar", "line", "area", "pie", "donut", "ring", "progress", "number", "poll"];
const DEVICES = ["phone", "tablet", "laptop", "monitor", "tv", "browser", "polaroid", "vinyl"];
const SOLIDS = ["sphere", "cube", "cylinder", "cone", "torus", "pyramid", "capsule"];
const AMBIENTS = ["aurora", "flow", "bokeh", "particles", "waves", "rays", "grid", "grain"];
const TEXT_EFFECTS = ["lift", "hollow", "splice", "echo", "glitch", "neon"];
const FILTERS = ["vivid", "warm", "cool", "fade", "retro", "dramatic", "mono", "noir", "amber", "slate", "ash"];
const CLOCKS = ["both", "elapsed", "remaining", "percent"];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_PAINTS = ["text", "muted", "accent", "onAccent", "background"];
// Named finishes the painter draws as gradients of its own; only these names, never a CSS value.
const METAL_PAINTS = ["metal:gold", "metal:rose", "metal:silver", "metal:bronze", "metal:champagne"];
// A drawing is painted on every frame; the largest in the library has 29 paths and 6 KB, so these leave plenty of room.
const MOST_PATHS = 64;
const MOST_PATH_DATA = 60_000;
// Path data: commands and numbers only, so nothing else can ride along in a saved drawing.
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
// A colour in a drawing: hex, rgb()/rgba() with numbers only, or the layer's own colour.
const ART_PAINT = /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|currentColor|none)$/i;

/** A graphic's drawing from storage, its paths and colours checked, or null when it can't be drawn. */
function parseArt(value: unknown): Art | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.w !== "number" || typeof v.h !== "number" || !(v.w > 0 && v.w <= 4096) || !(v.h > 0 && v.h <= 4096) || !Array.isArray(v.paths)) return null;
  if (v.paths.length > MOST_PATHS) return null;
  let total = 0;
  const paths: Art["paths"] = [];
  for (const raw of v.paths) {
    if (!raw || typeof raw !== "object") continue;
    const part = raw as Record<string, unknown>;
    if (typeof part.d !== "string" || part.d.length > 20000 || !PATH.test(part.d) || !/^\s*[Mm]/.test(part.d)) continue;
    total += part.d.length;
    if (total > MOST_PATH_DATA) return null;
    const path: Art["paths"][number] = { d: part.d };
    if (typeof part.fill === "string" && ART_PAINT.test(part.fill)) path.fill = part.fill;
    if (typeof part.stroke === "string" && ART_PAINT.test(part.stroke)) path.stroke = part.stroke;
    if (typeof part.width === "number" && part.width > 0 && part.width <= 100) path.width = part.width;
    if (part.rule === "evenodd") path.rule = "evenodd";
    // A two-tone icon's background and an emoji's highlights are faded parts of the drawing.
    if (typeof part.opacity === "number" && part.opacity >= 0 && part.opacity < 1) path.opacity = part.opacity;
    paths.push(path);
  }
  return paths.length ? { w: v.w, h: v.h, paths } : null;
}
const VISUALS: Visual[] = ["bars", "wave", "pulse", "ring", "radial", "mirror", "line", "dots", "blocks", "scope"];

/** A colour from storage when it is a hex colour, one of the theme's names or a metal; otherwise nothing. */
function paintIn(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 40) return undefined;
  return HEX.test(value) || THEME_PAINTS.includes(value) || METAL_PAINTS.includes(value) ? value : undefined;
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** A page colour from storage: a hex colour, with a gradient's second colour and angle when they are sound. */
function parsePage(value: unknown): Page | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.color !== "string" || !HEX.test(v.color)) return undefined;
  const page: Page = { color: v.color };
  if (typeof v.to === "string" && HEX.test(v.to) && typeof v.angle === "number" && v.angle >= 0 && v.angle <= 360) {
    page.to = v.to;
    page.angle = v.angle;
  }
  return page;
}

/** One layer from storage, its fields of the right kind and in range, or null when it can't be one. */
function parseLayer(value: unknown): Layer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const number = (key: string) => (typeof v[key] === "number" && Number.isFinite(v[key]) ? (v[key] as number) : undefined);
  const text = (key: string, longest: number) => (typeof v[key] === "string" ? (v[key] as string).slice(0, longest) : undefined);
  if (typeof v.id !== "string" || !KINDS.has(v.kind as string)) return null;
  const [x, y, w, h] = ["x", "y", "w", "h"].map(number);
  if (x === undefined || y === undefined || w === undefined || h === undefined) return null;
  if (w <= 0 || h <= 0 || w > 4 || h > 4 || Math.abs(x) > 4 || Math.abs(y) > 4) return null;
  const layer: Record<string, unknown> = { id: v.id.slice(0, 80), kind: v.kind, x, y, w, h, rotation: number("rotation") ?? 0, opacity: clamp(number("opacity") ?? 1, 0, 1) };
  const put = (key: string, found: unknown) => found !== undefined && (layer[key] = found);
  for (const key of ["hidden", "locked", "italic", "flipX", "flipY", "shadow", "uppercase", "underline", "strike", "arrowStart", "arrowEnd", "autoWidth", "backdrop", "header", "stripes", "showLabels", "showValues", "showGrid", "gloss", "react"]) put(key, typeof v[key] === "boolean" ? v[key] : undefined);
  put("text", text("text", 2000));
  put("font", text("font", 80));
  put("image", text("image", 80));
  // Colours are hex or one of the theme's names: anything else could reach the page as CSS and load from elsewhere.
  for (const key of ["color", "highlight", "fill", "outline", "background", "effectColor", "stroke"]) put(key, paintIn(v[key]));
  // A moving effect laid over the design has no ground of its own.
  if (v.kind === "ambient" && v.fill === "none") put("fill", "none");
  put("group", text("group", 80));
  const size = number("size");
  put("size", size === undefined ? undefined : clamp(size, 8, 400));
  const weight = number("weight");
  put("weight", weight === undefined ? undefined : clamp(Math.round(weight), 100, 1000));
  const radius = number("radius");
  put("radius", radius === undefined ? undefined : clamp(radius, 0, 0.5));
  put("align", ["left", "center", "right"].includes(v.align as string) ? v.align : undefined);
  put("shape", SHAPES.includes(v.shape as string) ? v.shape : undefined);
  put("mask", SHAPES.includes(v.mask as string) ? v.mask : undefined);
  put("effect", TEXT_EFFECTS.includes(v.effect as string) ? v.effect : undefined);
  put("filter", FILTERS.includes(v.filter as string) ? v.filter : undefined);
  put("list", v.list === "bullet" || v.list === "number" ? v.list : undefined);
  put("dash", ["solid", "dashed", "dotted"].includes(v.dash as string) ? v.dash : undefined);
  put("exit", ENTRANCES.includes(v.exit as string) ? v.exit : undefined);
  put("loop", LOOPS.includes(v.loop as string) ? v.loop : undefined);
  put("direction", DIRECTIONS.includes(v.direction as string) ? v.direction : undefined);
  put("chart", CHARTS.includes(v.chart as string) ? v.chart : undefined);
  put("device", DEVICES.includes(v.device as string) ? v.device : undefined);
  put("solid", SOLIDS.includes(v.solid as string) ? v.solid : undefined);
  put("ambient", AMBIENTS.includes(v.ambient as string) ? v.ambient : undefined);
  put("rules", ["none", "rows", "grid"].includes(v.rules as string) ? v.rules : undefined);
  put("cap", v.cap === "round" ? "round" : undefined);
  put("clock", CLOCKS.includes(v.clock as string) ? v.clock : undefined);
  put("prefix", text("prefix", 8));
  put("suffix", text("suffix", 8));
  // A chart's rows: up to twelve, each a short label and a finite value, with a colour of its own if it is sound.
  if (Array.isArray(v.data)) {
    const rows = v.data.flatMap((row): Array<Record<string, unknown>> => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      const r = row as Record<string, unknown>;
      if (typeof r.label !== "string" || typeof r.value !== "number" || !Number.isFinite(r.value)) return [];
      const datum: Record<string, unknown> = { label: r.label.slice(0, 40), value: clamp(r.value, -1e9, 1e9) };
      const colour = paintIn(r.color);
      if (colour) datum.color = colour;
      return [datum];
    }).slice(0, 12);
    put("data", rows.length ? rows : undefined);
  }
  // A table's cells: up to ten rows of up to six short strings.
  if (Array.isArray(v.cells)) {
    const rows = v.cells.filter(Array.isArray).slice(0, 10).map((row) => (row as unknown[]).slice(0, 6).map((cell) => (typeof cell === "string" ? cell.slice(0, 120) : "")));
    put("cells", rows.length && rows.every((row) => row.length) ? rows : undefined);
  }
  const ranged = (key: string, low: number, high: number) => {
    const value = number(key);
    put(key, value === undefined ? undefined : clamp(value, low, high));
  };
  ranged("letterSpacing", -200, 800);
  ranged("lineHeight", 0.5, 2.5);
  ranged("curve", -100, 100);
  ranged("strokeWidth", 0, 100);
  ranged("speed", 0.25, 4);
  ranged("pace", 0.25, 3);
  ranged("bend", -100, 100);
  ranged("max", -1e9, 1e9);
  // Frosted glass: the blur, in pixels of a 1080 frame, behind a shape.
  ranged("frost", 0, 60);
  if (v.crop && typeof v.crop === "object" && !Array.isArray(v.crop)) {
    const crop = v.crop as Record<string, unknown>;
    const finite = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
    put("crop", { x: clamp(finite(crop.x, 0), -1, 1), y: clamp(finite(crop.y, 0), -1, 1), zoom: clamp(finite(crop.zoom, 1), 1, 4) });
  }
  if (v.kind === "graphic") {
    const art = parseArt(v.art);
    if (!art) return null;
    layer.art = art;
  }
  put("visual", VISUALS.includes(v.visual as Visual) ? v.visual : undefined);
  put("enter", ENTRANCES.includes(v.enter as string) ? v.enter : undefined);
  for (const key of ["from", "until"]) {
    const seconds = number(key);
    put(key, seconds === undefined ? undefined : clamp(seconds, 0, 1e6));
  }
  if (v.adjust && typeof v.adjust === "object" && !Array.isArray(v.adjust)) {
    const tone = v.adjust as Record<string, unknown>;
    const adjust: Record<string, number> = {};
    for (const [key, high] of [["brightness", 2], ["contrast", 2], ["saturation", 2], ["blur", 20]] as const) {
      const value = tone[key];
      if (typeof value === "number" && Number.isFinite(value)) adjust[key] = clamp(value, 0, high);
    }
    put("adjust", Object.keys(adjust).length ? adjust : undefined);
  }
  return layer as unknown as Layer;
}

const KEY = "soundbite:kit";
const LAYOUTS: Layout[] = ["square", "portrait", "story", "landscape"];

/** A saved kit, keeping only fields of the right kind. Anything unreadable is an empty kit; it never throws. */
export function parseKit(raw: string | null): Kit {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "");
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const value = data as Record<string, unknown>;
  const kit: Kit = {};
  for (const field of ["title", "speaker", "handle"] as const) {
    if (typeof value[field] === "string") kit[field] = value[field] as string;
  }
  if (LAYOUTS.includes(value.layout as Layout)) kit.layout = value.layout as Layout;
  if (VISUALS.includes(value.visual as Visual)) kit.visual = value.visual as Visual;
  if (Number.isInteger(value.theme) && (value.theme as number) >= 0) kit.theme = value.theme as number;
  const level = value.musicVolume;
  if (typeof level === "number" && level >= 0 && level <= 1) kit.musicVolume = level;
  for (const field of ["cover", "background"] as const) {
    const picture = value[field];
    if (typeof picture === "string" && picture.startsWith("data:image/")) kit[field] = picture;
  }
  if (Array.isArray(value.links)) {
    const links = value.links.filter((link): link is string => typeof link === "string" && link.length <= 80).slice(0, 3);
    if (links.length) kit.links = links;
  }
  if (value.layers && typeof value.layers === "object" && !Array.isArray(value.layers)) {
    const layers: Partial<Record<Layout, Layer[]>> = {};
    for (const shape of LAYOUTS) {
      const list = (value.layers as Record<string, unknown>)[shape];
      if (Array.isArray(list)) layers[shape] = list.map(parseLayer).filter((layer): layer is Layer => layer !== null).slice(0, 200);
    }
    if (Object.keys(layers).length) kit.layers = layers;
  }
  const page = parsePage(value.page);
  if (page !== undefined) kit.page = page;
  // Recently used: a short list of the editor's own names for its elements, such as "shape:star".
  if (Array.isArray(value.recent)) {
    const recent = value.recent.filter((item): item is string => typeof item === "string" && /^[a-z0-9]+:[a-z0-9-]+$/.test(item)).slice(0, 12);
    if (recent.length) kit.recent = recent;
  }
  return kit;
}

// Storage can be full, blocked or missing (a private window); the kit is a convenience, so it fails quietly.
export function loadKit(): Kit {
  try {
    return parseKit(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export function saveKit(kit: Kit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(kit));
  } catch {
    // Not kept this time; the clip itself is unaffected.
  }
}

/** A picture kept as a data URL, as a Blob again, or null when it isn't a picture's data URL. */
export function dataUrlBlob(url: string): Blob | null {
  const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?,(.*)$/is.exec(url);
  if (!match) return null;
  try {
    const text = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    return new Blob([Uint8Array.from(text, (letter) => letter.charCodeAt(0))], { type: match[1].toLowerCase() });
  } catch {
    return null;
  }
}

const SVG = "image/svg+xml";
// A drawing this small is kept as it is: it stays sharp at any size and takes less room than a picture of it would.
const SVG_KEPT = 64 * 1024;

/** A picture ready to draw on a canvas. An SVG goes through an <img>, since createImageBitmap can't read one from a
 *  Blob in every browser. */
async function drawable(blob: Blob): Promise<{ image: CanvasImageSource; width: number; height: number; close(): void }> {
  if (blob.type !== SVG) {
    const bitmap = await createImageBitmap(blob);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

const dataUrlOf = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** A picture cut to a centred square and shrunk to `size` pixels, as a JPEG data URL small enough to keep; a small SVG
 *  is kept whole, as a drawing. */
export async function shrinkCover(blob: Blob, size = 256): Promise<string> {
  if (blob.type === SVG && blob.size <= SVG_KEPT) return dataUrlOf(blob);
  const image = await drawable(blob);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(image.image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

/**
 * A picture shrunk to fit `size` pixels on its longer side, its shape kept, as a data URL: a JPEG for a photo, a PNG
 * where transparency has to survive.
 */
export async function fitPicture(blob: Blob, size: number, type: "image/jpeg" | "image/png"): Promise<string> {
  const image = await drawable(blob);
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")!.drawImage(image.image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL(type, 0.82);
}
