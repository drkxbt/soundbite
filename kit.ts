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
};

const KINDS = new Set(["avatar", "name", "handle", "title", "visual", "time", "captions", "links", "text", "image", "video", "shape", "graphic"]);
const SHAPES = ["rect", "ellipse", "triangle", "star", "heart", "arrow", "diamond", "bubble", "pentagon", "hexagon", "octagon", "cross", "parallelogram", "arch", "line"];
const ENTRANCES = ["fade", "rise", "pan", "slide", "pop", "wipe", "blur", "zoom", "breathe", "baseline", "drift", "tumble", "stomp", "bounce", "flicker", "typewriter"];
const LOOPS = ["pulse", "wiggle", "rotate", "float"];
const TEXT_EFFECTS = ["lift", "hollow", "splice", "echo", "glitch", "neon"];
const FILTERS = ["vivid", "warm", "cool", "fade", "retro", "dramatic", "mono", "noir"];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_PAINTS = ["text", "muted", "accent", "onAccent", "background"];
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
    paths.push(path);
  }
  return paths.length ? { w: v.w, h: v.h, paths } : null;
}
const VISUALS: Visual[] = ["bars", "wave", "pulse"];
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
  for (const key of ["hidden", "locked", "italic", "flipX", "flipY", "shadow", "uppercase", "underline", "strike", "arrowStart", "arrowEnd"]) put(key, typeof v[key] === "boolean" ? v[key] : undefined);
  put("text", text("text", 2000));
  put("font", text("font", 80));
  put("image", text("image", 80));
  // Colours are hex or one of the theme's names: anything else could reach the page as CSS and load from elsewhere.
  for (const key of ["color", "highlight", "fill", "outline", "background", "effectColor", "stroke"]) {
    const paint = text(key, 40);
    put(key, paint && (HEX.test(paint) || THEME_PAINTS.includes(paint)) ? paint : undefined);
  }
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
  const ranged = (key: string, low: number, high: number) => {
    const value = number(key);
    put(key, value === undefined ? undefined : clamp(value, low, high));
  };
  ranged("letterSpacing", -200, 800);
  ranged("lineHeight", 0.5, 2.5);
  ranged("curve", -100, 100);
  ranged("strokeWidth", 0, 100);
  ranged("speed", 0.25, 4);
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

/** A picture cut to a centred square and shrunk to `size` pixels, as a JPEG data URL small enough to keep. */
export async function shrinkCover(blob: Blob, size = 256): Promise<string> {
  const image = await createImageBitmap(blob);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

/**
 * A picture shrunk to fit `size` pixels on its longer side, its shape kept, as a data URL: a JPEG for a photo, a PNG
 * where transparency has to survive.
 */
export async function fitPicture(blob: Blob, size: number, type: "image/jpeg" | "image/png"): Promise<string> {
  const image = await createImageBitmap(blob);
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL(type, 0.82);
}
