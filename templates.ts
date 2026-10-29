/* Twenty ready-made looks for podcast and live audio clips, each laid out for every frame shape the editor offers. A
   template is only layers, so once it is picked every part of it can be moved, restyled or deleted, and the words on
   its labels are sample copy for the user to change. Free of the DOM, so it can be tested on its own. */
import { FRAME_SIZES, type Art, type Layer, type LayerKind, type Layout, type Page, type Template } from "@drkxbt/audiogram";

/** A design the user can start a clip from, laid out for whichever frame shape they picked. */
export interface TemplateChoice {
  id: string;
  name: string;
  make(layout: Layout): Template;
}

type Style = Partial<Omit<Layer, "id" | "kind" | "x" | "y" | "w" | "h">>;

// Places in THEMES. A template sets every colour it can, but the theme still paints the avatar's initial when there is
// no photo and the words of a caption not yet said, so each template names a theme whose muted colour reads on its page.
const INK = 0;
const PAPER = 1;
const MINT = 2;
const DUSK = 3;
const EMBER = 4;

const MONO = "JetBrains Mono Variable";

/** A frame shape being laid out in its own pixels; the layers keep their boxes as fractions of it, as the editor does. */
interface Frame {
  width: number;
  height: number;
  /** One design pixel: font sizes and fixed lengths are given for a frame whose shorter side is 1080. */
  unit: number;
  /** The margin the editor's own layouts keep round the edges. */
  pad: number;
  wide: boolean;
  tall: boolean;
  /** The value given for this frame's shape. */
  by<T>(values: Record<Layout, T>): T;
  /** Adds a layer over the ones before it, at a box in frame pixels; its id is the kind and `name`. */
  add(kind: LayerKind, name: string, x: number, y: number, w: number, h: number, style?: Style): void;
  /** How tall `count` lines of words at `size` stand. */
  lines(size: number, count?: number, spacing?: number): number;
}

function template(id: string, name: string, page: Page, theme: number, draw: (frame: Frame) => void): TemplateChoice {
  return {
    id,
    name,
    make(layout) {
      const { width, height } = FRAME_SIZES[layout];
      const unit = Math.min(width, height) / 1080;
      const layers: Layer[] = [];
      draw({
        width,
        height,
        unit,
        pad: Math.round(Math.min(width, height) * 0.074),
        wide: layout === "landscape",
        tall: layout === "story",
        by: (values) => values[layout],
        add: (kind, name, x, y, w, h, style = {}) => {
          layers.push({ id: `${kind}-${name}`, kind, x: x / width, y: y / height, w: w / width, h: h / height, rotation: 0, opacity: 1, ...style });
        },
        lines: (size, count = 1, spacing = 1.15) => size * unit * spacing * count,
      });
      return { layers, page: { ...page }, theme };
    },
  };
}

/** Where a line of words starts so its capitals sit centred on `middle`: canvas words hang from the top of their em
 *  box, and capitals fill roughly the band between a twentieth and four fifths of the size below it. */
function capsTop(f: Frame, middle: number, size: number): number {
  return middle - size * f.unit * 0.42;
}

/** How wide a line of JetBrains Mono runs: every letter takes six tenths of the size, and the spacing after it. */
function monoWidth(f: Frame, text: string, size: number, spacing = 0): number {
  return text.length * size * f.unit * (0.6 + spacing / 1000);
}

interface PillStyle {
  size: number;
  fill: string;
  color: string;
  height?: number;
  spacing?: number;
  stroke?: string;
}

/** A short label on a round-ended pill sized to fit it, set in a monospaced face so its width is known before it is
 *  drawn. Returns the pill's width, so a row can be laid out from it. */
function pill(f: Frame, name: string, x: number, y: number, text: string, style: PillStyle): number {
  const { size, spacing = 140 } = style;
  const h = (style.height ?? size * 2.3) * f.unit;
  const w = monoWidth(f, text, size, spacing) + h;
  f.add("shape", name, x, y, w, h, { shape: "rect", radius: 0.5, fill: style.fill, ...(style.stroke ? { stroke: style.stroke, strokeWidth: 2 } : {}) });
  f.add("text", name, x, capsTop(f, y + h / 2, size), w, f.lines(size), { text, font: MONO, size, weight: 700, color: style.color, align: "center", uppercase: true, letterSpacing: spacing });
  return w;
}

/** The avatar with the name and the handle stacked beside it, centred on it, the three running `w` wide. */
function byline(f: Frame, x: number, y: number, side: number, w: number, name: Style, handle: Style): void {
  const nameH = f.lines(name.size ?? 40, 1, 1.3);
  const handleH = f.lines(handle.size ?? 30, 1, 1.3);
  const textX = x + side * 1.22;
  const top = y + (side - nameH - handleH) / 2;
  f.add("avatar", "main", x, y, side, side);
  f.add("name", "main", textX, top, x + w - textX, nameH, { align: "left", ...name });
  f.add("handle", "main", textX, top + nameH, x + w - textX, handleH, { align: "left", ...handle });
}

/** A disc just larger than the avatar it sits under, so the avatar reads as framed by a ring of `fill`. */
function ring(f: Frame, x: number, y: number, side: number, thickness: number, fill: string): void {
  const t = thickness * f.unit;
  f.add("shape", "ring", x - t, y - t, side + t * 2, side + t * 2, { shape: "ellipse", fill });
}

const CUP: Art = {
  w: 64,
  h: 64,
  paths: [
    { d: "M8 24h40v12c0 10-8 18-18 18h-4C16 54 8 46 8 36z", fill: "currentColor" },
    { d: "M48 28h3a8 8 0 0 1 0 16h-4", stroke: "currentColor", width: 5 },
    { d: "M21 5c-4 4 4 7 0 12M33 5c-4 4 4 7 0 12", stroke: "currentColor", width: 4 },
    { d: "M4 60h52", stroke: "currentColor", width: 5 },
  ],
};

const LEAF: Art = {
  w: 48,
  h: 48,
  paths: [
    { d: "M42 6C22 6 7 17 7 33c0 3 1 6 3 8 2-12 10-21 22-26-10 7-16 16-17 27 2 1 4 1 6 1 17 0 23-15 21-37z", fill: "currentColor" },
  ],
};

/** A rising line chart with the ground under it shaded, drawn for a box `ratio` times as wide as it is tall, so it
 *  fills the box instead of shrinking into the middle of it. */
function chartArt(ratio: number, line: string, ground: string): Art {
  const h = 100;
  const w = h * ratio;
  const rises = [0.78, 0.66, 0.72, 0.52, 0.58, 0.4, 0.47, 0.3, 0.36, 0.18, 0.24, 0.1];
  const points = rises.map((rise, index) => `${((index / (rises.length - 1)) * w).toFixed(1)} ${(rise * h).toFixed(1)}`);
  const path = `M${points.join(" L")}`;
  return {
    w,
    h,
    paths: [
      { d: `${path} L${w} ${h} L0 ${h} Z`, fill: ground },
      { d: path, stroke: line, width: 3 },
    ],
  };
}

/** A dark studio card: an on-air light, the speaker and the show up top, captions in the middle, a mint meter below. */
const studioDark = template("studio-dark", "Studio Dark", { color: "#1c1e23", to: "#0b0c0e", angle: 180 }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const text = "#f5f5f4";
  const soft = "#8b9099";
  const mint = "#2ff0b8";
  const inset = P * 0.5;
  const left = P * 1.2;
  const right = W - P * 1.2;
  const top = f.tall ? H * 0.09 : P * 1.2;
  const bottom = f.tall ? H * 0.86 : H - P * 1.2;
  const column = f.wide ? W * 0.34 : right - left;
  f.add("shape", "card", inset, inset, W - inset * 2, H - inset * 2, { shape: "rect", fill: "#15171b", radius: 0.035, stroke: "#2a2d34", strokeWidth: 2 });

  const lightH = 48 * u;
  f.add("shape", "air", left, top, 168 * u, lightH, { shape: "rect", radius: 0.5, fill: "#2b1619" });
  f.add("shape", "light", left + 20 * u, top + lightH / 2 - 7 * u, 14 * u, 14 * u, { shape: "ellipse", fill: "#ff4d4d", loop: "pulse" });
  f.add("text", "air", left + 46 * u, capsTop(f, top + lightH / 2, 22), 112 * u, f.lines(22), { text: "On air", font: MONO, size: 22, weight: 700, color: "#ff6b6b", uppercase: true, letterSpacing: 160 });
  f.add("text", "episode", right - 320 * u, capsTop(f, top + lightH / 2, 22), 320 * u, f.lines(22), { text: "Episode 12", font: MONO, size: 22, weight: 600, color: soft, align: "right", uppercase: true, letterSpacing: 160 });

  const bylineY = top + lightH + 56 * u;
  byline(f, left, bylineY, 112 * u, column, { font: "Inter Variable", size: 44, weight: 700, color: text }, { font: "Inter Variable", size: 30, weight: 500, color: soft });
  const titleSize = f.wide ? 60 : 54;
  const titleY = bylineY + 112 * u + 40 * u;
  const titleH = f.lines(titleSize, f.wide ? 3 : 2);
  f.add("title", "main", left, titleY, column, titleH, { font: "Inter Variable", size: titleSize, weight: 750, color: text, lineHeight: 1.15, enter: "rise" });

  const footY = bottom - 34 * u;
  f.add("links", "main", left, footY, column, 34 * u, { font: MONO, size: 22, weight: 500, color: "#6b7079", align: "left" });
  f.add("time", "main", right - 300 * u, footY, 300 * u, 34 * u, { font: MONO, size: 22, weight: 500, color: soft, align: "right" });

  const captions = { font: "Inter Variable", size: f.by({ square: 60, portrait: 72, story: 82, landscape: 68 }), weight: 800, color: "#ffffff", highlight: mint, align: "left" as const };
  if (f.wide) {
    const x = left + column + P * 1.2;
    f.add("shape", "divider", left + column + P * 0.6, top, 2 * u, bottom - top, { shape: "rect", fill: "#2a2d34" });
    const visualH = H * 0.16;
    const visualY = footY - 36 * u - visualH;
    f.add("captions", "main", x, top + lightH + 40 * u, right - x, visualY - 40 * u - (top + lightH + 40 * u), captions);
    f.add("visual", "main", x, visualY, right - x, visualH, { visual: "bars", color: mint });
    return;
  }
  const visualH = H * 0.12;
  const visualY = footY - 36 * u - visualH;
  const captionsY = titleY + titleH + 40 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 36 * u - captionsY, captions);
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "bars", color: mint });
});

/** A clean white card on pale grey: blue for the episode, the word being said and the sound. */
const cleanWhite = template("clean-white", "Clean White", { color: "#eceff3" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const ink = "#0f172a";
  const soft = "#64748b";
  const blue = "#2563eb";
  const font = "DM Sans Variable";
  const inset = P * 0.6;
  const left = P * 1.4;
  const right = W - P * 1.4;
  const top = f.tall ? H * 0.1 : P * 1.4;
  const bottom = f.tall ? H * 0.85 : H - P * 1.4;
  const column = f.wide ? W * 0.36 : right - left;
  f.add("shape", "card", inset, inset, W - inset * 2, H - inset * 2, { shape: "rect", fill: "#ffffff", radius: 0.04, stroke: "#dfe4ea", strokeWidth: 2 });

  f.add("text", "episode", left, top, column, f.lines(24), { text: "Episode 12", font, size: 24, weight: 700, color: blue, uppercase: true, letterSpacing: 140 });
  const titleSize = f.by({ square: 50, portrait: 58, story: 64, landscape: 62 });
  const titleY = top + 48 * u;
  const titleH = f.lines(titleSize, f.wide ? 3 : 2, 1.1);
  f.add("title", "main", left, titleY, column, titleH, { font, size: titleSize, weight: 700, color: ink, lineHeight: 1.1, letterSpacing: -10 });

  const side = 88 * u;
  const rowY = bottom - side;
  const listenW = monoWidth(f, "Listen now", 22, 140) + 52 * u;
  byline(f, left, rowY, side, column - (f.wide ? 0 : listenW + 24 * u), { font, size: 34, weight: 700, color: ink }, { font, size: 26, weight: 500, color: soft });
  pill(f, "listen", right - listenW, rowY + side / 2 - 26 * u, "Listen now", { size: 22, height: 52, fill: blue, color: "#ffffff" });

  const captions = { font, size: f.by({ square: 58, portrait: 68, story: 78, landscape: 66 }), weight: 700, color: ink, highlight: blue, align: "left" as const };
  const x = f.wide ? left + column + P * 1.2 : left;
  const ruleY = f.wide ? top : titleY + titleH + 36 * u;
  if (f.wide) f.add("shape", "rule", left + column + P * 0.6, top, 2 * u, bottom - top, { shape: "rect", fill: "#e2e8f0" });
  else f.add("shape", "rule", left, ruleY, right - left, 4 * u, { shape: "line", fill: "#e2e8f0", strokeWidth: 2 });
  const timeY = (f.wide ? rowY : rowY - 48 * u) - 30 * u;
  const visualH = H * (f.wide ? 0.14 : 0.1);
  const visualY = timeY - 10 * u - visualH;
  const captionsY = f.wide ? top : ruleY + 36 * u;
  f.add("captions", "main", x, captionsY, right - x, visualY - 32 * u - captionsY, captions);
  f.add("visual", "main", x, visualY, right - x, visualH, { visual: "bars", color: blue });
  f.add("time", "main", f.wide ? x : right - 300 * u, timeY, f.wide ? 300 * u : 300 * u, 30 * u, { font, size: 22, weight: 600, color: soft, align: f.wide ? "left" : "right" });
});

/** Captions as the whole picture: huge white capitals on black, the word being said lit yellow. */
const bigCaptions = template("big-captions", "Bold Captions", { color: "#0c0c0c" }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const yellow = "#ffd400";
  const grey = "#8a8a8a";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.84 : H - P;
  const side = 88 * u;
  byline(f, left, top, side, (right - left) * 0.62, { font: "Inter Variable", size: 34, weight: 700, color: "#ffffff" }, { font: "Inter Variable", size: 26, weight: 500, color: grey });
  f.add("text", "tag", right - 360 * u, capsTop(f, top + side / 2, 26), 354 * u, f.lines(26), {
    text: "Hot take", font: "Archivo Black", size: 26, weight: 400, color: "#0c0c0c", background: yellow, align: "right", uppercase: true, letterSpacing: 40, enter: "pop",
  });

  const footY = bottom - 34 * u;
  f.add("title", "main", left, footY - 4 * u, (right - left) * 0.68, f.lines(26), { font: "Inter Variable", size: 26, weight: 600, color: grey });
  f.add("time", "main", right - 260 * u, footY, 260 * u, 34 * u, { font: "Inter Variable", size: 24, weight: 600, color: grey, align: "right" });
  const visualH = f.by({ square: 90, portrait: 120, story: 150, landscape: 100 }) * u;
  const visualY = footY - 32 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "wave", color: yellow });
  const captionsY = top + side + 48 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 40 * u - captionsY, {
    font: "Archivo Black", size: f.by({ square: 90, portrait: 100, story: 110, landscape: 96 }), weight: 400, color: "#ffffff", highlight: yellow, align: "center", uppercase: true,
  });
});

/** A pull quote: a giant orange quotation mark over warm paper, the words set in a display serif. */
const boldQuote = template("bold-quote", "Bold Quote", { color: "#f3ece1" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const ink = "#1d1a16";
  const soft = "#7a7268";
  const orange = "#ff5a1f";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.84 : H - P;
  // 400 is the largest size the editor keeps.
  const markSize = f.by({ square: 340, portrait: 400, story: 400, landscape: 340 });
  f.add("text", "mark", left - markSize * 0.04 * u, top - markSize * 0.12 * u, markSize * 0.6 * u, markSize * 0.62 * u, { text: "“", font: "DM Serif Display", size: markSize, weight: 400, color: orange, lineHeight: 1 });
  f.add("title", "main", right - (right - left) * 0.55, top, (right - left) * 0.55, f.lines(22, 2, 1.4), { font: "Inter Variable", size: 22, weight: 600, color: soft, align: "right", uppercase: true, letterSpacing: 160, lineHeight: 1.4 });

  const side = 96 * u;
  const bylineY = bottom - side;
  byline(f, left, bylineY, side, (right - left) * 0.6, { font: "Inter Variable", size: 34, weight: 700, color: ink }, { font: "Inter Variable", size: 26, weight: 500, color: soft });
  const visualW = (f.wide ? 420 : 300) * u;
  f.add("visual", "main", right - visualW, bylineY + 4 * u, visualW, 64 * u, { visual: "bars", color: ink });
  f.add("time", "main", right - visualW, bylineY + 70 * u, visualW, 26 * u, { font: "Inter Variable", size: 20, weight: 600, color: soft, align: "right" });
  const ruleY = bylineY - 48 * u;
  f.add("shape", "rule", left, ruleY, 72 * u, 6 * u, { shape: "line", fill: orange, strokeWidth: 6 });

  const captionsY = top + markSize * 0.42 * u;
  f.add("captions", "main", left, captionsY, (right - left) * (f.wide ? 0.86 : 1), ruleY - 32 * u - captionsY, {
    font: "DM Serif Display", size: f.by({ square: 76, portrait: 90, story: 100, landscape: 84 }), weight: 400, color: ink, highlight: orange, align: "left",
  });
});

/** Late-night radio in neon: a glowing sign, a cyan-edged panel for the words, magenta for the word being said. */
const neonNight = template("neon-night", "Neon Night", { color: "#0a0420", to: "#250a4d", angle: 160 }, DUSK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const pink = "#ff2bd6";
  const cyan = "#00e5ff";
  const lilac = "#b9a6ff";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P * 0.9;
  const bottom = f.tall ? H * 0.84 : H - P;
  const signSize = f.by({ square: 84, portrait: 92, story: 100, landscape: 96 });
  f.add("text", "sign", left, top, right - left, f.lines(signSize, 1, 1.1), { text: "Late night", font: "Monoton", size: signSize, weight: 400, color: pink, align: "center", uppercase: true, effect: "neon", lineHeight: 1.1, loop: "pulse", speed: 0.5 });
  const titleY = top + f.lines(signSize, 1, 1.1) + 20 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(26), { font: "Outfit Variable", size: 26, weight: 600, color: lilac, align: "center", uppercase: true, letterSpacing: 240 });

  const side = 88 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 5, pink);
  byline(f, left, rowY, side, (right - left) * 0.7, { font: "Outfit Variable", size: 36, weight: 600, color: "#ffffff" }, { font: "Outfit Variable", size: 26, weight: 400, color: lilac });
  f.add("time", "main", right - 260 * u, rowY + side / 2 - 17 * u, 260 * u, 34 * u, { font: MONO, size: 24, weight: 600, color: cyan, align: "right" });

  const panelY = titleY + f.lines(26) + 44 * u;
  const panelH = rowY - 48 * u - panelY;
  f.add("shape", "panel", left, panelY, right - left, panelH, { shape: "rect", fill: "#12082e", radius: 0.06, stroke: cyan, strokeWidth: 3 });
  const inner = 44 * u;
  const visualH = Math.min(panelH * 0.26, 150 * u);
  const visualY = panelY + panelH - inner - visualH;
  f.add("visual", "main", left + inner, visualY, right - left - inner * 2, visualH, { visual: "bars", color: cyan });
  f.add("captions", "main", left + inner, panelY + inner, right - left - inner * 2, visualY - 24 * u - panelY - inner, {
    font: "Outfit Variable", size: f.by({ square: 60, portrait: 68, story: 78, landscape: 70 }), weight: 700, color: "#ffffff", highlight: pink, align: "center", effect: "neon",
  });
});

/** A sunrise: a violet sky warming to coral, a half sun on the horizon, and the sound rippling under it. */
const sunrise = template("sunrise", "Sunrise Glow", { color: "#2a1b5c", to: "#f2875e", angle: 180 }, DUSK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const peach = "#ffd9a8";
  const sun = "#ffc46b";
  const font = "Poppins";
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const captions = { font, size: f.by({ square: 58, portrait: 64, story: 74, landscape: 64 }), weight: 700, color: "#ffffff", highlight: sun };

  if (f.wide) {
    const left = P;
    const column = W * 0.46;
    f.add("title", "main", left, top, column, f.lines(24), { font, size: 24, weight: 700, color: peach, uppercase: true, letterSpacing: 220 });
    const side = 104 * u;
    ring(f, left, top + 64 * u, side, 6, sun);
    byline(f, left, top + 64 * u, side, column, { font, size: 38, weight: 700, color: "#ffffff" }, { font, size: 26, weight: 400, color: peach });
    const captionsY = top + 64 * u + side + 48 * u;
    f.add("captions", "main", left, captionsY, column, bottom - captionsY, { ...captions, align: "left" });
    const sunW = W * 0.34;
    const centre = W * 0.74;
    const horizonY = H * 0.62;
    f.add("shape", "sun", centre - sunW / 2, horizonY - sunW / 2, sunW, sunW / 2, { shape: "arch", fill: sun, enter: "rise" });
    f.add("shape", "horizon", W * 0.54, horizonY, W * 0.4, 4 * u, { shape: "line", fill: peach, strokeWidth: 3 });
    f.add("visual", "main", W * 0.56, horizonY + 32 * u, W * 0.36, 120 * u, { visual: "bars", color: "#fff1e0", opacity: 0.9 });
    f.add("time", "main", W * 0.56, horizonY + 172 * u, W * 0.36, 32 * u, { font, size: 24, weight: 400, color: "#fff1e0", align: "center" });
    return;
  }

  const left = P;
  const right = W - P;
  f.add("title", "main", left, top, right - left, f.lines(24), { font, size: 24, weight: 700, color: peach, align: "center", uppercase: true, letterSpacing: 220 });
  const side = f.by({ square: 96, portrait: 120, story: 140, landscape: 120 }) * u;
  const avatarY = top + 64 * u;
  ring(f, W / 2 - side / 2, avatarY, side, 6, sun);
  f.add("avatar", "main", W / 2 - side / 2, avatarY, side, side);
  f.add("name", "main", left, avatarY + side + 18 * u, right - left, f.lines(38, 1, 1.3), { font, size: 38, weight: 700, color: "#ffffff", align: "center" });
  f.add("handle", "main", left, avatarY + side + 18 * u + f.lines(38, 1, 1.3), right - left, f.lines(26, 1, 1.3), { font, size: 26, weight: 400, color: peach, align: "center" });

  const timeY = bottom - 32 * u;
  f.add("time", "main", left, timeY, right - left, 32 * u, { font, size: 24, weight: 400, color: "#fff1e0", align: "center" });
  const visualH = f.by({ square: 64, portrait: 90, story: 120, landscape: 90 }) * u;
  const visualY = timeY - 16 * u - visualH;
  f.add("visual", "main", left + 60 * u, visualY, right - left - 120 * u, visualH, { visual: "bars", color: "#fff1e0", opacity: 0.9 });
  const horizonY = visualY - 24 * u;
  f.add("shape", "horizon", left, horizonY, right - left, 4 * u, { shape: "line", fill: peach, strokeWidth: 3 });
  const sunW = W * f.by({ square: 0.36, portrait: 0.48, story: 0.62, landscape: 0.5 });
  f.add("shape", "sun", W / 2 - sunW / 2, horizonY - sunW / 2 + 2 * u, sunW, sunW / 2, { shape: "arch", fill: sun, enter: "rise" });
  const captionsY = avatarY + side + 18 * u + f.lines(38, 1, 1.3) + f.lines(26, 1, 1.3) + 36 * u;
  f.add("captions", "main", left, captionsY, right - left, horizonY - sunW / 2 - 28 * u - captionsY, { ...captions, align: "center" });
});

/** A news desk: a photo up top, a red and white lower third with the speaker's name, and a ticker along the foot. */
const newsroom = template("newsroom", "Newsroom Lower Third", { color: "#0f1216" }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const red = "#d62839";
  const ink = "#0f1216";
  const font = "Inter Variable";
  const tickerH = 68 * u;
  const tickerY = f.tall ? H * 0.84 : H - tickerH;
  const photoW = f.wide ? W * 0.6 : W;
  const photoH = f.wide ? tickerY : H * f.by({ square: 0.5, portrait: 0.52, story: 0.46, landscape: 1 });
  const photoY = f.tall ? H * 0.06 : 0;
  // The painter clips a picture to its box only when the frame has a mask, so a plain photo frame is masked as a rect.
  f.add("image", "photo", 0, photoY, photoW, photoH, { mask: "rect" });

  const edge = P * 0.6;
  f.add("text", "live", edge + 8 * u, photoY + edge, 120 * u, f.lines(28), { text: "Live", font: "Oswald Variable", size: 28, weight: 600, color: "#ffffff", background: red, uppercase: true, letterSpacing: 120, loop: "pulse", speed: 0.5 });
  f.add("time", "main", edge + 112 * u, photoY + edge - 3 * u, 220 * u, 38 * u, { font: "Oswald Variable", size: 26, weight: 500, color: "#ffffff", background: ink, align: "left" });

  // The lower third sits across the photo's foot, the avatar overlapping its left end.
  const side = 132 * u;
  const barsX = edge + side + 24 * u;
  const barsW = photoW - edge - barsX;
  const nameBarY = photoY + photoH - (f.wide ? 150 : 96) * u;
  ring(f, edge, nameBarY - 6 * u, side, 6, "#ffffff");
  f.add("avatar", "main", edge, nameBarY - 6 * u, side, side);
  f.add("shape", "namebar", barsX, nameBarY, barsW, 64 * u, { shape: "rect", fill: red, enter: "wipe" });
  f.add("name", "main", barsX + 22 * u, nameBarY, barsW - 44 * u, 64 * u, { font: "Oswald Variable", size: 38, weight: 600, color: "#ffffff", uppercase: true, letterSpacing: 40, align: "left" });
  f.add("shape", "handlebar", barsX, nameBarY + 64 * u, barsW, 48 * u, { shape: "rect", fill: "#ffffff", enter: "wipe" });
  f.add("handle", "main", barsX + 22 * u, nameBarY + 64 * u, barsW * 0.45, 48 * u, { font, size: 24, weight: 700, color: ink, align: "left" });
  f.add("title", "main", barsX + barsW * 0.45, nameBarY + 64 * u + 24 * u - f.lines(20) / 2, barsW * 0.55 - 22 * u, f.lines(20), { font, size: 20, weight: 600, color: "#5b636d", align: "right", uppercase: true, letterSpacing: 60 });

  const captionsX = f.wide ? photoW + P * 0.8 : P;
  const captionsY = f.wide ? P : photoY + photoH + 64 * u;
  f.add("captions", "main", captionsX, captionsY, W - P * (f.wide ? 0.8 : 1) - captionsX, tickerY - 40 * u - captionsY, {
    font, size: f.by({ square: 54, portrait: 60, story: 70, landscape: 58 }), weight: 800, color: "#ffffff", highlight: red, align: "left",
  });

  f.add("shape", "ticker", 0, tickerY, W, tickerH, { shape: "rect", fill: "#1b2027" });
  f.add("shape", "next", 0, tickerY, 170 * u, tickerH, { shape: "rect", fill: red });
  f.add("text", "next", 0, capsTop(f, tickerY + tickerH / 2, 26), 170 * u, f.lines(26), { text: "Up next", font: "Oswald Variable", size: 26, weight: 600, color: "#ffffff", align: "center", uppercase: true, letterSpacing: 80 });
  const visualW = 150 * u;
  f.add("text", "ticker", 200 * u, capsTop(f, tickerY + tickerH / 2, 24), W - 200 * u - visualW - 56 * u, f.lines(24), { text: "Rate cuts, hiring, and what founders should do next", font, size: 24, weight: 500, color: "#d0d5db" });
  f.add("visual", "main", W - visualW - 28 * u, tickerY + 16 * u, visualW, tickerH - 32 * u, { visual: "bars", color: "#ffffff" });
});

/** Black on warm grey in monospace: crop marks, hairline rules and a recording light, nothing more. */
const minimalMono = template("minimal-mono", "Minimal Mono", { color: "#ecebe6" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const ink = "#111111";
  const grey = "#77756f";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const mark = { text: "+", font: "Space Mono", size: 32, weight: 400, color: grey, lineHeight: 1 } as const;
  const corner = P * 0.32;
  f.add("text", "mark-tl", corner, corner, 40 * u, 40 * u, mark);
  f.add("text", "mark-tr", W - corner - 40 * u, corner, 40 * u, 40 * u, { ...mark, align: "right" });
  f.add("text", "mark-bl", corner, H - corner - 40 * u, 40 * u, 40 * u, mark);
  f.add("text", "mark-br", W - corner - 40 * u, H - corner - 40 * u, 40 * u, 40 * u, { ...mark, align: "right" });

  const rowMiddle = top + 16 * u;
  f.add("shape", "rec", left, rowMiddle - 7 * u, 14 * u, 14 * u, { shape: "ellipse", fill: "#e5484d", loop: "pulse" });
  f.add("text", "rec", left + 28 * u, capsTop(f, rowMiddle, 22), 360 * u, f.lines(22), { text: "Rec  Ep.012", font: MONO, size: 22, weight: 600, color: ink, uppercase: true, letterSpacing: 120 });
  f.add("time", "main", right - 300 * u, rowMiddle - 16 * u, 300 * u, 32 * u, { font: MONO, size: 22, weight: 500, color: ink, align: "right" });
  const ruleY = top + 52 * u;
  f.add("shape", "rule-top", left, ruleY, right - left, 2 * u, { shape: "line", fill: ink, strokeWidth: 2 });

  const titleSize = f.by({ square: 42, portrait: 46, story: 52, landscape: 46 });
  const titleY = ruleY + 40 * u;
  const titleH = f.lines(titleSize, 2, 1.2);
  f.add("title", "main", left, titleY, (right - left) * (f.wide ? 0.6 : 1), titleH, { font: "Space Mono", size: titleSize, weight: 700, color: ink, lineHeight: 1.2, enter: "typewriter" });

  const side = 72 * u;
  const footY = bottom - side;
  byline(f, left, footY, side, (right - left) * 0.6, { font: MONO, size: 28, weight: 700, color: ink }, { font: MONO, size: 22, weight: 400, color: grey });
  f.add("links", "main", right - (right - left) * 0.4, footY + side / 2 - 16 * u, (right - left) * 0.4, 32 * u, { font: MONO, size: 20, weight: 500, color: grey, align: "right" });
  const lowRuleY = footY - 32 * u;
  f.add("shape", "rule-low", left, lowRuleY, right - left, 2 * u, { shape: "line", fill: ink, strokeWidth: 2 });
  const visualH = H * f.by({ square: 0.08, portrait: 0.09, story: 0.08, landscape: 0.1 });
  const visualY = lowRuleY - 32 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "wave", color: ink });
  const captionsY = titleY + titleH + 40 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 32 * u - captionsY, {
    font: MONO, size: f.by({ square: 52, portrait: 58, story: 66, landscape: 56 }), weight: 600, color: ink, highlight: ink, align: "left",
  });
});

/** An old valve radio: a walnut page, a cream tuning dial with the sound in it, and a slab serif for the words. */
const retroRadio = template("retro-radio", "Retro Radio", { color: "#2b1911", to: "#170d08", angle: 180 }, EMBER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const cream = "#f6e7cc";
  const orange = "#ff8a3d";
  const brown = "#5a3a22";
  const soft = "#d19c8c";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.09 : P * 0.8;
  const bottom = f.tall ? H * 0.86 : H - P;
  const signSize = f.by({ square: 80, portrait: 90, story: 100, landscape: 84 });
  const signH = f.lines(signSize, 1, 1.6);
  f.add("text", "sign", left, top, right - left, signH, { text: "On the air", font: "Shrikhand", size: signSize, weight: 400, color: orange, align: "center", curve: 10, effect: "lift" });
  const titleY = top + signH + 4 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(24), { font: "Roboto Slab Variable", size: 24, weight: 600, color: cream, align: "center", uppercase: true, letterSpacing: 200 });

  const dialY = titleY + f.lines(24) + 36 * u;
  const dialH = f.by({ square: 180, portrait: 240, story: 280, landscape: 200 }) * u;
  const dialX = f.wide ? W * 0.2 : left;
  const dialW = f.wide ? W * 0.6 : right - left;
  f.add("shape", "dial", dialX, dialY, dialW, dialH, { shape: "rect", fill: "#f3e3c3", radius: 0.12, stroke: "#c9a66b", strokeWidth: 6 });
  // Each frequency is its own layer: the painter folds runs of spaces, so one line of them couldn't be spread out.
  const band = dialW - 80 * u;
  ["88", "92", "96", "100", "104", "108"].forEach((mark, index, marks) => {
    const centre = dialX + 40 * u + (band * index) / (marks.length - 1);
    f.add("text", `band-${mark}`, centre - 40 * u, dialY + 22 * u, 80 * u, f.lines(22), { text: mark, font: "Space Mono", size: 22, weight: 700, color: brown, align: "center" });
  });
  f.add("shape", "ticks", dialX + 40 * u, dialY + 58 * u, dialW - 80 * u, 10 * u, { shape: "line", fill: brown, strokeWidth: 6, dash: "dotted" });
  f.add("visual", "main", dialX + 40 * u, dialY + 82 * u, dialW - 80 * u, dialH - 104 * u, { visual: "bars", color: brown });
  f.add("shape", "needle", dialX + dialW * 0.62, dialY + 14 * u, 6 * u, dialH - 28 * u, { shape: "rect", fill: "#e4572e", loop: "wiggle", speed: 0.4 });

  const side = 96 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 6, orange);
  byline(f, left, rowY, side, (right - left) * 0.7, { font: "Roboto Slab Variable", size: 36, weight: 700, color: cream }, { font: "Space Mono", size: 22, weight: 400, color: soft });
  f.add("time", "main", right - 260 * u, rowY + side / 2 - 16 * u, 260 * u, 32 * u, { font: "Space Mono", size: 22, weight: 400, color: soft, align: "right" });
  const captionsY = dialY + dialH + 44 * u;
  f.add("captions", "main", left, captionsY, right - left, rowY - 40 * u - captionsY, {
    font: "Roboto Slab Variable", size: f.by({ square: 56, portrait: 68, story: 78, landscape: 64 }), weight: 700, color: cream, highlight: orange, align: "center",
  });
});

/** Half photo, half plum: the speaker's picture fills one side, the words and the sound the other. */
const splitPhoto = template("split-photo", "Split Photo", { color: "#2a1b3d" }, DUSK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const peach = "#ffb38a";
  const cream = "#fff4ec";
  const lilac = "#c7b5e0";
  const font = "Bricolage Grotesque Variable";
  const side = 132 * u;
  const captions = { font, size: f.by({ square: 54, portrait: 60, story: 70, landscape: 60 }), weight: 700, color: cream, highlight: peach, align: "left" as const };
  const label = { text: "Episode 12", font, size: 24, weight: 700, color: "#2a1b3d", background: peach, uppercase: true, letterSpacing: 120 } as const;

  if (f.wide) {
    const splitX = W * 0.46;
    f.add("image", "photo", 0, 0, splitX, H, { mask: "rect" });
    f.add("text", "episode", P * 0.75, P * 0.75, 300 * u, f.lines(24), label);
    const left = splitX + P;
    const right = W - P;
    byline(f, left, P, 104 * u, right - left, { font, size: 38, weight: 700, color: cream }, { font, size: 26, weight: 500, color: lilac });
    const titleY = P + 104 * u + 36 * u;
    f.add("title", "main", left, titleY, right - left, f.lines(52, 2, 1.1), { font, size: 52, weight: 800, color: peach, lineHeight: 1.1 });
    const timeY = H - P - 30 * u;
    f.add("time", "main", left, timeY, right - left, 30 * u, { font, size: 22, weight: 500, color: lilac, align: "right" });
    const visualY = timeY - 12 * u - 110 * u;
    f.add("visual", "main", left, visualY, right - left, 110 * u, { visual: "bars", color: peach });
    const captionsY = titleY + f.lines(52, 2, 1.1) + 32 * u;
    f.add("captions", "main", left, captionsY, right - left, visualY - 32 * u - captionsY, captions);
    return;
  }

  const left = P;
  const right = W - P;
  const splitY = H * f.by({ square: 0.4, portrait: 0.44, story: 0.42, landscape: 0.44 });
  f.add("image", "photo", 0, 0, W, splitY, { mask: "rect" });
  f.add("shape", "seam", 0, splitY, W, 8 * u, { shape: "rect", fill: peach });
  f.add("text", "episode", left, f.tall ? H * 0.08 : P * 0.75, 300 * u, f.lines(24), label);
  ring(f, left, splitY - side / 2, side, 8, peach);
  f.add("avatar", "main", left, splitY - side / 2, side, side);
  const nameX = left + side + 28 * u;
  f.add("name", "main", nameX, splitY + 16 * u, right - nameX, f.lines(38, 1, 1.3), { font, size: 38, weight: 700, color: cream, align: "left" });
  f.add("handle", "main", nameX, splitY + 16 * u + f.lines(38, 1, 1.3), right - nameX, f.lines(26, 1, 1.3), { font, size: 26, weight: 500, color: lilac, align: "left" });
  const titleSize = f.by({ square: 44, portrait: 48, story: 56, landscape: 48 });
  const titleY = splitY + side / 2 + 40 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(titleSize, 2, 1.1), { font, size: titleSize, weight: 800, color: peach, lineHeight: 1.1 });
  const bottom = f.tall ? H * 0.86 : H - P;
  const timeY = bottom - 30 * u;
  f.add("time", "main", left, timeY, right - left, 30 * u, { font, size: 22, weight: 500, color: lilac, align: "right" });
  const visualH = f.by({ square: 72, portrait: 96, story: 130, landscape: 96 }) * u;
  const visualY = timeY - 10 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "bars", color: peach });
  const captionsY = titleY + f.lines(titleSize, 2, 1.1) + 28 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 24 * u - captionsY, captions);
});

/** An interview: two arched photo frames side by side, host and guest named under them, a pulse between. */
const twoGuests = template("two-guests", "Two Guests", { color: "#ece8f6" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const purple = "#5b3cc4";
  const ink = "#1b1530";
  const soft = "#6d6585";
  const font = "Space Grotesk Variable";
  const top = f.tall ? H * 0.09 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const gap = 32 * u;
  const role = { font, size: 20, weight: 700, color: purple, align: "center" as const, uppercase: true, letterSpacing: 220 };

  // Two arched frames, each with its role and its person's name under it.
  const guests = (x: number, y: number, w: number, h: number) => {
    const frameW = (w - gap) / 2;
    f.add("image", "host", x, y, frameW, h, { mask: "arch" });
    f.add("image", "guest", x + frameW + gap, y, frameW, h, { mask: "arch" });
    const pulse = 120 * u;
    f.add("visual", "main", x + w / 2 - pulse / 2, y + h - pulse * 0.8, pulse, pulse, { visual: "pulse", color: purple });
    const roleY = y + h + 22 * u;
    const nameY = roleY + f.lines(20) + 6 * u;
    f.add("text", "host", x, roleY, frameW, f.lines(20), { text: "Host", ...role });
    f.add("text", "guest", x + frameW + gap, roleY, frameW, f.lines(20), { text: "Guest", ...role });
    f.add("name", "main", x, nameY, frameW, f.lines(34, 1, 1.3), { font, size: 34, weight: 700, color: ink, align: "center" });
    f.add("text", "guest-name", x + frameW + gap, nameY + (f.lines(34, 1, 1.3) - f.lines(34)) / 2, frameW, f.lines(34), { text: "Jordan Lee", font, size: 34, weight: 700, color: ink, align: "center" });
    return nameY + f.lines(34, 1, 1.3);
  };
  const captions = { font, size: f.by({ square: 50, portrait: 56, story: 66, landscape: 56 }), weight: 700, color: ink, highlight: purple };
  const footY = bottom - 30 * u;

  if (f.wide) {
    const left = P;
    const half = W * 0.5;
    guests(left, P, half - left, H - P * 2 - 100 * u);
    const x = half + P * 0.75;
    const right = W - P;
    f.add("text", "label", x, P, right - x, f.lines(24), { text: "In conversation", font, size: 24, weight: 700, color: purple, uppercase: true, letterSpacing: 220 });
    f.add("title", "main", x, P + 48 * u, right - x, f.lines(54, 2, 1.1), { font, size: 54, weight: 700, color: ink, lineHeight: 1.1 });
    f.add("handle", "main", x, footY, (right - x) * 0.6, 30 * u, { font, size: 24, weight: 500, color: soft, align: "left" });
    f.add("time", "main", right - 240 * u, footY, 240 * u, 30 * u, { font, size: 22, weight: 500, color: soft, align: "right" });
    const captionsY = P + 48 * u + f.lines(54, 2, 1.1) + 40 * u;
    f.add("captions", "main", x, captionsY, right - x, footY - 32 * u - captionsY, { ...captions, align: "left" });
    return;
  }

  const left = P;
  const right = W - P;
  f.add("text", "label", left, top, right - left, f.lines(22), { text: "In conversation", font, size: 22, weight: 700, color: purple, align: "center", uppercase: true, letterSpacing: 220 });
  const titleSize = f.by({ square: 42, portrait: 48, story: 56, landscape: 48 });
  const titleLines = f.by({ square: 1, portrait: 2, story: 2, landscape: 2 });
  const titleY = top + 44 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(titleSize, titleLines, 1.1), { font, size: titleSize, weight: 700, color: ink, align: "center", lineHeight: 1.1 });
  const framesY = titleY + f.lines(titleSize, titleLines, 1.1) + 36 * u;
  const frameH = ((right - left - gap) / 2) * f.by({ square: 0.78, portrait: 1.05, story: 1.35, landscape: 1 });
  const namesEnd = guests(left, framesY, right - left, frameH);
  f.add("handle", "main", left, footY, (right - left) * 0.6, 30 * u, { font, size: 24, weight: 500, color: soft, align: "left" });
  f.add("time", "main", right - 240 * u, footY, 240 * u, 30 * u, { font, size: 22, weight: 500, color: soft, align: "right" });
  const captionsY = namesEnd + 28 * u;
  f.add("captions", "main", left, captionsY, right - left, footY - 24 * u - captionsY, { ...captions, align: "center" });
});

/** The sound as the hero: a wide amber waveform across deep teal, the time set large under it. */
const bigWaveform = template("big-waveform", "Big Waveform", { color: "#04293a", to: "#0a4b5c", angle: 180 }, MINT, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const amber = "#f2b84b";
  const cream = "#f4f1e8";
  const mint = "#8cd3b9";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const titleSize = f.by({ square: 50, portrait: 56, story: 64, landscape: 56 });
  const column = f.wide ? (right - left) * 0.6 : right - left;
  f.add("text", "playing", left, top, column, f.lines(22), { text: "Now playing", font: "Space Mono", size: 22, weight: 700, color: amber, uppercase: true, letterSpacing: 220 });
  const titleY = top + 44 * u;
  const titleH = f.lines(titleSize, 2, 1.05);
  f.add("title", "main", left, titleY, column, titleH, { font: "Syne Variable", size: titleSize, weight: 800, color: cream, lineHeight: 1.05 });

  const side = 88 * u;
  const captions = { font: "Syne Variable", size: f.by({ square: 52, portrait: 58, story: 66, landscape: 56 }), weight: 700, color: cream, highlight: amber, align: "left" as const };
  const waveY = titleY + titleH + (f.wide ? 56 : 44) * u;
  const waveH = H * f.by({ square: 0.22, portrait: 0.24, story: 0.22, landscape: 0.28 });
  f.add("shape", "axis", left, waveY + waveH / 2 - 1 * u, right - left, 2 * u, { shape: "line", fill: amber, strokeWidth: 2, opacity: 0.35 });
  f.add("visual", "main", left, waveY, right - left, waveH, { visual: "wave", color: amber });
  const timeSize = f.by({ square: 38, portrait: 42, story: 50, landscape: 42 });
  const timeY = waveY + waveH + 16 * u;
  f.add("time", "main", left, timeY, 420 * u, f.lines(timeSize, 1, 1.3), { font: "Space Mono", size: timeSize, weight: 700, color: amber, align: "left" });

  if (f.wide) {
    byline(f, right - (right - left) * 0.32, top, side, (right - left) * 0.32, { font: "Syne Variable", size: 32, weight: 700, color: cream }, { font: "Space Mono", size: 22, weight: 400, color: mint });
    const captionsY = timeY + f.lines(timeSize, 1, 1.3) + 20 * u;
    f.add("captions", "main", left, captionsY, right - left, bottom - captionsY, captions);
    return;
  }
  const rowY = bottom - side;
  byline(f, left, rowY, side, right - left, { font: "Syne Variable", size: 32, weight: 700, color: cream }, { font: "Space Mono", size: 22, weight: 400, color: mint });
  const captionsY = timeY + f.lines(timeSize, 1, 1.3) + 28 * u;
  f.add("captions", "main", left, captionsY, right - left, rowY - 36 * u - captionsY, captions);
});

/** A soft pastel card on pink, rounded type, and a few paper shapes tucked round its corners. */
const pastelCard = template("pastel-card", "Pastel Card", { color: "#fde4ea" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const ink = "#3d2c3e";
  const soft = "#8a7a8c";
  const font = "Fredoka Variable";
  const blob = W * (f.wide ? 0.24 : 0.42);
  f.add("shape", "blob", P * 0.2, H - P * 0.2 - blob, blob, blob, { shape: "ellipse", fill: "#cdb4f0" });
  const inset = P * 0.6;
  f.add("shape", "card", inset, inset, W - inset * 2, H - inset * 2, { shape: "rect", fill: "#fffaf6", radius: 0.06 });
  const star = 150 * u;
  f.add("shape", "star", W - P * 0.3 - star, P * 0.3, star, star, { shape: "star", fill: "#ffd2a8", rotation: 12, loop: "float", speed: 0.5 });
  const heart = 72 * u;
  f.add("shape", "heart", W - inset - heart * 0.7, H - inset - heart * 0.7, heart, heart * 0.9, { shape: "heart", fill: "#f7a8c4", rotation: -10 });

  const left = P * 1.3;
  const right = W - P * 1.3;
  const top = f.tall ? H * 0.1 : P * 1.3;
  const bottom = f.tall ? H * 0.86 : H - P * 1.3;
  const column = f.wide ? W * 0.36 : right - left;
  f.add("text", "episode", left + 6 * u, top + 4 * u, column, f.lines(24), { text: "Episode 12", font, size: 24, weight: 600, color: "#5b3e8a", background: "#ece1ff", uppercase: true, letterSpacing: 100 });
  const titleSize = f.by({ square: 50, portrait: 54, story: 62, landscape: 60 });
  const titleY = top + 60 * u;
  const titleH = f.lines(titleSize, f.wide ? 3 : 2, 1.1);
  f.add("title", "main", left, titleY, column, titleH, { font, size: titleSize, weight: 700, color: ink, lineHeight: 1.1 });

  const side = 96 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 6, "#ffd2a8");
  byline(f, left, rowY, side, column, { font, size: 34, weight: 700, color: ink }, { font, size: 26, weight: 500, color: soft });
  const captions = { font, size: f.by({ square: 54, portrait: 60, story: 70, landscape: 62 }), weight: 600, color: ink, highlight: "#9ad8c4", align: "center" as const };
  const x = f.wide ? left + column + P : left;
  const timeY = (f.wide ? bottom : rowY - 36 * u) - 30 * u;
  f.add("time", "main", x, timeY, right - x, 30 * u, { font, size: 22, weight: 500, color: soft, align: "center" });
  const visualH = H * (f.wide ? 0.14 : 0.09);
  const visualY = timeY - 10 * u - visualH;
  f.add("visual", "main", x, visualY, right - x, visualH, { visual: "bars", color: "#f7a8c4" });
  const captionsY = f.wide ? top : titleY + titleH + 32 * u;
  f.add("captions", "main", x, captionsY, right - x, visualY - 28 * u - captionsY, captions);
});

/** A magazine cover: a photo under a red masthead, a cover line, the words below and the sound as its barcode. */
const magazineCover = template("magazine-cover", "Magazine Cover", { color: "#f6f2ea" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const red = "#c8102e";
  const ink = "#1a1a1a";
  const soft = "#6b6560";
  const serif = "Libre Baskerville";
  const sans = "Inter Variable";
  const edge = P * 0.5;
  const captions = { font: serif, size: f.by({ square: 40, portrait: 46, story: 54, landscape: 46 }), weight: 700, color: ink, highlight: red, align: "left" as const };
  const kicker = { text: "The interview", font: sans, size: 22, weight: 800, color: "#ffffff", background: red, uppercase: true, letterSpacing: 200 } as const;

  if (f.wide) {
    const photoW = W * 0.5;
    f.add("image", "photo", edge, edge, photoW, H - edge * 2, { mask: "rect" });
    const left = edge + photoW + P * 0.75;
    const right = W - P * 0.75;
    f.add("text", "masthead", left, edge - 10 * u, right - left, f.lines(124, 1, 1.05), { text: "The Weekly", font: "Abril Fatface", size: 124, weight: 400, color: red, uppercase: true, lineHeight: 1.05 });
    const issueY = edge + f.lines(124, 1, 1.05);
    f.add("text", "issue", left, issueY, right - left, f.lines(20), { text: "Issue 12 · The audio edition", font: sans, size: 20, weight: 700, color: soft, uppercase: true, letterSpacing: 240 });
    f.add("text", "kicker", left + 6 * u, issueY + 64 * u, right - left, f.lines(22), kicker);
    f.add("title", "main", left, issueY + 108 * u, right - left, f.lines(50, 2, 1.15), { font: serif, size: 50, weight: 700, color: ink });
    const footY = H - P * 0.75 - 72 * u;
    const captionsY = issueY + 108 * u + f.lines(50, 2, 1.15) + 32 * u;
    f.add("captions", "main", left, captionsY, right - left, footY - 28 * u - captionsY, captions);
    byline(f, left, footY, 72 * u, (right - left) * 0.6, { font: sans, size: 26, weight: 700, color: ink }, { font: sans, size: 20, weight: 500, color: soft });
    f.add("visual", "main", right - 200 * u, footY, 200 * u, 50 * u, { visual: "bars", color: ink });
    f.add("time", "main", right - 200 * u, footY + 52 * u, 200 * u, 22 * u, { font: MONO, size: 16, weight: 500, color: ink, align: "center" });
    return;
  }

  const photoH = H * f.by({ square: 0.64, portrait: 0.68, story: 0.66, landscape: 0.68 });
  const photoY = f.tall ? H * 0.05 : edge;
  // A dark ground under the cover photo, so the white title reads before a photo is dropped in, and in the video.
  f.add("shape", "backing", edge, photoY, W - edge * 2, photoH, { shape: "rect", fill: "#2a2623" });
  f.add("image", "photo", edge, photoY, W - edge * 2, photoH, { mask: "rect" });
  const mastSize = f.by({ square: 124, portrait: 132, story: 140, landscape: 132 });
  f.add("text", "masthead", edge, photoY + 8 * u, W - edge * 2, f.lines(mastSize, 1, 1.05), { text: "The Weekly", font: "Abril Fatface", size: mastSize, weight: 400, color: red, align: "center", uppercase: true, lineHeight: 1.05 });
  const issueY = photoY + 8 * u + f.lines(mastSize, 1, 1.05) + 4 * u;
  f.add("text", "issue", edge, issueY, W - edge * 2, f.lines(20), { text: "Issue 12 · The audio edition", font: sans, size: 20, weight: 700, color: "#ffffff", align: "center", uppercase: true, letterSpacing: 240, shadow: true });
  const left = P;
  const right = W - P;
  const titleSize = f.by({ square: 40, portrait: 44, story: 52, landscape: 44 });
  const titleH = f.lines(titleSize, 2, 1.15);
  const titleY = photoY + photoH - P * 0.5 - titleH;
  f.add("title", "main", left, titleY, (right - left) * 0.8, titleH, { font: serif, size: titleSize, weight: 700, color: "#ffffff", shadow: true });
  f.add("text", "kicker", left + 6 * u, titleY - 44 * u, right - left, f.lines(22), kicker);

  const bottom = f.tall ? H * 0.88 : H - P * 0.6;
  const footY = bottom - 64 * u;
  byline(f, left, footY, 64 * u, (right - left) * 0.6, { font: sans, size: 24, weight: 700, color: ink }, { font: sans, size: 20, weight: 500, color: soft });
  f.add("visual", "main", right - 180 * u, footY - 4 * u, 180 * u, 46 * u, { visual: "bars", color: ink });
  f.add("time", "main", right - 180 * u, footY + 44 * u, 180 * u, 22 * u, { font: MONO, size: 16, weight: 500, color: ink, align: "center" });
  const captionsY = photoY + photoH + 24 * u;
  f.add("captions", "main", left, captionsY, right - left, footY - 16 * u - captionsY, captions);
});

/** A developer's window: traffic-light dots, a terminal prompt, green for the word being said, blue for the sound. */
const techTalk = template("tech-talk", "Tech Talk", { color: "#0d1117" }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const text = "#e6edf3";
  const soft = "#8b949e";
  const green = "#3fb950";
  const blue = "#58a6ff";
  const edge = "#30363d";
  const top = f.tall ? H * 0.09 : P * 0.6;
  const bottom = f.tall ? H * 0.86 : H - P * 0.6;
  const winX = P * 0.6;
  const winW = W - winX * 2;
  const side = 80 * u;
  const rowY = bottom - side;
  const winH = rowY - 36 * u - top;
  f.add("shape", "window", winX, top, winW, winH, { shape: "rect", fill: "#161b22", radius: 0.025, stroke: edge, strokeWidth: 2 });
  ["#ff5f57", "#febc2e", "#28c840"].forEach((fill, index) => {
    f.add("shape", `dot-${index + 1}`, winX + (28 + index * 30) * u, top + 26 * u, 18 * u, 18 * u, { shape: "ellipse", fill });
  });
  f.add("text", "path", winX, capsTop(f, top + 35 * u, 20), winW, f.lines(20), { text: "~/episodes/012", font: MONO, size: 20, weight: 500, color: soft, align: "center" });
  f.add("shape", "titlebar", winX, top + 68 * u, winW, 2 * u, { shape: "rect", fill: edge });

  const left = winX + 48 * u;
  const right = winX + winW - 48 * u;
  const promptY = top + 68 * u + 40 * u;
  f.add("text", "prompt", left, promptY, right - left, f.lines(24), { text: "> now playing", font: MONO, size: 24, weight: 600, color: green, enter: "typewriter" });
  const titleSize = f.by({ square: 40, portrait: 44, story: 50, landscape: 44 });
  const titleY = promptY + 44 * u;
  const titleH = f.lines(titleSize, 2, 1.2);
  f.add("title", "main", left, titleY, (right - left) * (f.wide ? 0.7 : 1), titleH, { font: MONO, size: titleSize, weight: 700, color: text, lineHeight: 1.2 });
  const timeY = top + winH - 40 * u - 28 * u;
  f.add("time", "main", right - 300 * u, timeY, 300 * u, 28 * u, { font: MONO, size: 20, weight: 500, color: soft, align: "right" });
  const visualH = H * (f.wide ? 0.12 : 0.09);
  const visualY = timeY - 10 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "bars", color: blue });
  const captionsY = titleY + titleH + 32 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 28 * u - captionsY, {
    font: "Space Grotesk Variable", size: f.by({ square: 52, portrait: 58, story: 66, landscape: 58 }), weight: 700, color: text, highlight: green, align: "left",
  });

  byline(f, winX, rowY, side, winW * 0.65, { font: "Space Grotesk Variable", size: 30, weight: 600, color: text }, { font: MONO, size: 22, weight: 400, color: soft });
  const tagW = monoWidth(f, "Tech talk", 20, 140) + 48 * u;
  pill(f, "tag", winX + winW - tagW, rowY + side / 2 - 24 * u, "Tech talk", { size: 20, height: 48, fill: "#1f6feb", color: "#ffffff" });
});

/** A slow Sunday morning: latte paper, a hand-written heading by a cup, the words on a stitched card. */
const coffeeChat = template("coffee-chat", "Coffee Chat", { color: "#eadcc8" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const brown = "#5a3825";
  const caramel = "#c7773a";
  const ink = "#3b2a20";
  const soft = "#8a6b55";
  const font = "Nunito Variable";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const cup = 76 * u;
  f.add("graphic", "cup", left, top, cup, cup, { art: CUP, color: caramel });
  const scriptSize = f.by({ square: 58, portrait: 62, story: 70, landscape: 62 });
  f.add("text", "heading", left + cup + 20 * u, top + cup / 2 - f.lines(scriptSize, 1, 1) * 0.6, right - left - cup - 20 * u, f.lines(scriptSize, 1, 1), { text: "Sunday coffee chat", font: "Caveat Variable", size: scriptSize, weight: 700, color: brown, lineHeight: 1 });
  const titleY = top + cup + 20 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(24), { font, size: 24, weight: 800, color: soft, uppercase: true, letterSpacing: 160 });

  const side = 96 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 6, caramel);
  byline(f, left, rowY, side, (right - left) * 0.7, { font, size: 34, weight: 800, color: ink }, { font, size: 26, weight: 600, color: soft });
  f.add("time", "main", right - 240 * u, rowY + side / 2 - 16 * u, 240 * u, 32 * u, { font, size: 24, weight: 700, color: soft, align: "right" });
  const visualH = f.by({ square: 70, portrait: 96, story: 120, landscape: 80 }) * u;
  const visualY = rowY - 40 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "wave", color: brown });
  const cardY = titleY + f.lines(24) + 36 * u;
  const cardH = visualY - 36 * u - cardY;
  f.add("shape", "card", left, cardY, right - left, cardH, { shape: "rect", fill: "#f7f0e6", radius: 0.08, stroke: "#cfb390", strokeWidth: 3, dash: "dashed" });
  const inner = 40 * u;
  f.add("captions", "main", left + inner, cardY + inner * 0.6, right - left - inner * 2, cardH - inner * 1.2, {
    font, size: f.by({ square: 54, portrait: 60, story: 68, landscape: 58 }), weight: 800, color: ink, highlight: caramel, align: "center",
  });
});

/** A chalkboard in a wooden frame: a lesson number in yellow chalk, the words written up in a hand-drawn face. */
const lecture = template("lecture", "Lecture Notes", { color: "#22382e", to: "#1a2c24", angle: 180 }, MINT, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const chalk = "#f2efe6";
  const yellow = "#f6d55c";
  const soft = "#a9c4b5";
  const wood = "#7a5532";
  const edge = P * 0.35;
  f.add("shape", "board", edge, edge, W - edge * 2, H - edge * 2, { shape: "rect", fill: "#26402f", radius: 0.012, stroke: wood, strokeWidth: 18 });
  const ledgeW = Math.min(W * 0.4, 420 * u);
  const ledgeY = H - edge - 44 * u;
  f.add("shape", "ledge", W / 2 - ledgeW / 2, ledgeY, ledgeW, 22 * u, { shape: "rect", fill: "#5c3f24", radius: 0.3 });
  f.add("shape", "chalk", W / 2 - ledgeW * 0.3, ledgeY - 12 * u, 72 * u, 12 * u, { shape: "rect", fill: chalk, radius: 0.5 });
  f.add("shape", "chalk-yellow", W / 2 + ledgeW * 0.08, ledgeY - 12 * u, 52 * u, 12 * u, { shape: "rect", fill: yellow, radius: 0.5 });

  const left = P * 1.1;
  const right = W - P * 1.1;
  const top = f.tall ? H * 0.09 : P * 1.1;
  const bottom = f.tall ? H * 0.84 : ledgeY - 40 * u;
  const column = f.wide ? (right - left) * 0.38 : right - left;
  f.add("text", "lesson", left, top, column, f.lines(26), { text: "Lecture 04", font: "Shantell Sans Variable", size: 26, weight: 700, color: yellow, uppercase: true, letterSpacing: 140 });
  const titleSize = f.by({ square: 54, portrait: 58, story: 66, landscape: 58 });
  const titleY = top + 50 * u;
  const titleH = f.lines(titleSize, f.wide ? 3 : 2, 1.25);
  f.add("title", "main", left, titleY, column, titleH, { font: "Kalam", size: titleSize, weight: 700, color: chalk, lineHeight: 1.25, underline: true });

  const side = 88 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 4, chalk);
  byline(f, left, rowY, side, column * (f.wide ? 1 : 0.7), { font: "Shantell Sans Variable", size: 30, weight: 700, color: chalk }, { font: "Shantell Sans Variable", size: 22, weight: 400, color: soft });
  const x = f.wide ? left + column + P : left;
  const timeY = f.wide ? bottom - 30 * u : rowY + side / 2 - 15 * u;
  f.add("time", "main", right - 240 * u, timeY, 240 * u, 30 * u, { font: "Shantell Sans Variable", size: 22, weight: 500, color: soft, align: "right" });
  const visualH = H * (f.wide ? 0.13 : 0.08);
  const visualY = (f.wide ? timeY - 16 * u : rowY - 36 * u) - visualH;
  f.add("visual", "main", x, visualY, right - x, visualH, { visual: "bars", color: chalk, opacity: 0.85 });
  const captionsY = f.wide ? top : titleY + titleH + 32 * u;
  f.add("captions", "main", x, captionsY, right - x, visualY - 28 * u - captionsY, {
    font: "Kalam", size: f.by({ square: 56, portrait: 62, story: 70, landscape: 62 }), weight: 700, color: chalk, highlight: yellow, align: "center",
  });
});

/** A sports desk: a slanted red banner, speed stripes, huge condensed capitals and a scoreboard clock. */
const sportsDesk = template("sports-desk", "Sports Desk", { color: "#0b1d4d", to: "#06102b", angle: 180 }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const red = "#e10600";
  const yellow = "#ffcc00";
  const soft = "#9fb3e6";
  const navy = "#0b1d4d";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.09 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const stripe = 36 * u;
  f.add("shape", "stripe-yellow", W - P * 0.3 - 300 * u, P * 0.3, 300 * u, stripe, { shape: "parallelogram", fill: yellow });
  f.add("shape", "stripe-red", W - P * 0.3 - 220 * u, P * 0.3 + stripe + 12 * u, 220 * u, stripe, { shape: "parallelogram", fill: red });

  const bannerH = 84 * u;
  const bannerY = top + (f.tall ? 0 : stripe * 2 + 12 * u);
  const bannerW = Math.min(right - left, 640 * u);
  f.add("shape", "banner", left, bannerY, bannerW, bannerH, { shape: "parallelogram", fill: red, enter: "slide" });
  f.add("text", "banner", left, capsTop(f, bannerY + bannerH / 2, 52) + 2 * u, bannerW, f.lines(52), { text: "The final word", font: "Anton", size: 52, weight: 400, color: "#ffffff", align: "center", uppercase: true, italic: true, letterSpacing: 20 });
  const titleY = bannerY + bannerH + 20 * u;
  f.add("title", "main", left, titleY, right - left, f.lines(26), { font: "Oswald Variable", size: 26, weight: 600, color: soft, uppercase: true, letterSpacing: 140 });

  const side = 96 * u;
  const rowY = bottom - side;
  ring(f, left, rowY, side, 6, yellow);
  byline(f, left, rowY, side, (right - left) * 0.7, { font: "Oswald Variable", size: 40, weight: 700, color: "#ffffff", uppercase: true }, { font: "Oswald Variable", size: 26, weight: 400, color: soft });
  const clockW = 210 * u;
  f.add("shape", "clock", right - clockW, rowY + side / 2 - 32 * u, clockW, 64 * u, { shape: "rect", fill: "#ffffff", radius: 0.12 });
  f.add("time", "main", right - clockW, rowY + side / 2 - 32 * u, clockW, 64 * u, { font: "Oswald Variable", size: 32, weight: 600, color: navy, align: "center" });
  const visualH = H * (f.wide ? 0.12 : 0.09);
  const visualY = rowY - 40 * u - visualH;
  f.add("visual", "main", left, visualY, right - left, visualH, { visual: "bars", color: yellow });
  const captionsY = titleY + f.lines(26) + 32 * u;
  f.add("captions", "main", left, captionsY, right - left, visualY - 32 * u - captionsY, {
    font: "Anton", size: f.by({ square: 84, portrait: 92, story: 104, landscape: 90 }), weight: 400, color: "#ffffff", highlight: yellow, align: "center", uppercase: true,
  });
});

/** Calm and airy: sage paper, soft round shapes, a leaf, and the sound as a slow breathing circle. */
const wellness = template("wellness", "Calm Wellness", { color: "#e4ebe0" }, PAPER, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const deep = "#2f4a3a";
  const sage = "#6f8f72";
  const soft = "#5f7a63";
  const serif = "Cormorant Garamond Variable";
  const sans = "Raleway Variable";
  const blob = Math.min(W, H) * 0.5;
  f.add("shape", "blob", W - P * 0.2 - blob, P * 0.2, blob, blob * 0.9, { shape: "ellipse", fill: "#d5e0cf" });
  f.add("shape", "blob-small", P * 0.2, H - P * 0.2 - blob * 0.62, blob * 0.72, blob * 0.62, { shape: "ellipse", fill: "#cddbc6" });
  const top = f.tall ? H * 0.1 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  const captions = { font: serif, size: f.by({ square: 58, portrait: 64, story: 74, landscape: 64 }), weight: 700, color: deep, highlight: sage, align: "center" as const };
  const leaf = 48 * u;

  if (f.wide) {
    const left = P * 1.2;
    const column = W * 0.4;
    f.add("graphic", "leaf", left, top, leaf, leaf, { art: LEAF, color: sage });
    f.add("text", "label", left, top + leaf + 24 * u, column, f.lines(22), { text: "Mindful minutes", font: sans, size: 22, weight: 600, color: soft, uppercase: true, letterSpacing: 300 });
    f.add("title", "main", left, top + leaf + 72 * u, column, f.lines(66, 3, 1.05), { font: serif, size: 66, weight: 600, color: deep, lineHeight: 1.05 });
    byline(f, left, bottom - 88 * u, 88 * u, column, { font: sans, size: 30, weight: 600, color: deep }, { font: sans, size: 22, weight: 400, color: soft });
    const x = left + column + P;
    const right = W - P;
    const pulse = 240 * u;
    f.add("visual", "main", x + (right - x) / 2 - pulse / 2, top, pulse, pulse, { visual: "pulse", color: sage });
    f.add("captions", "main", x, top + pulse + 32 * u, right - x, bottom - top - pulse - 32 * u, captions);
    return;
  }

  const left = P;
  const right = W - P;
  f.add("graphic", "leaf", W / 2 - leaf / 2, top, leaf, leaf, { art: LEAF, color: sage });
  f.add("text", "label", left, top + leaf + 20 * u, right - left, f.lines(22), { text: "Mindful minutes", font: sans, size: 22, weight: 600, color: soft, align: "center", uppercase: true, letterSpacing: 300 });
  const titleSize = f.by({ square: 54, portrait: 60, story: 70, landscape: 60 });
  const titleY = top + leaf + 64 * u;
  const titleH = f.lines(titleSize, 2, 1.05);
  f.add("title", "main", left, titleY, right - left, titleH, { font: serif, size: titleSize, weight: 600, color: deep, align: "center", lineHeight: 1.05 });
  const pulse = f.by({ square: 180, portrait: 240, story: 320, landscape: 240 }) * u;
  const pulseY = titleY + titleH + 28 * u;
  f.add("visual", "main", W / 2 - pulse / 2, pulseY, pulse, pulse, { visual: "pulse", color: sage });

  const side = 80 * u;
  const handleY = bottom - f.lines(22, 1, 1.3);
  const nameY = handleY - f.lines(30, 1, 1.3);
  const avatarY = nameY - 12 * u - side;
  f.add("avatar", "main", W / 2 - side / 2, avatarY, side, side);
  f.add("name", "main", left, nameY, right - left, f.lines(30, 1, 1.3), { font: sans, size: 30, weight: 600, color: deep, align: "center" });
  f.add("handle", "main", left, handleY, right - left, f.lines(22, 1, 1.3), { font: sans, size: 22, weight: 400, color: soft, align: "center" });
  const captionsY = pulseY + pulse + 24 * u;
  f.add("captions", "main", left, captionsY, right - left, avatarY - 28 * u - captionsY, captions);
});

/** A morning market note: three tickers, a rising chart, and green for the word being said. */
const financeBrief = template("finance-brief", "Finance Brief", { color: "#0f1420" }, INK, (f) => {
  const { width: W, height: H, pad: P, unit: u } = f;
  const text = "#f1f3f7";
  const soft = "#7d8597";
  const green = "#16c784";
  const red = "#ea3943";
  const font = "Archivo Variable";
  const left = P;
  const right = W - P;
  const top = f.tall ? H * 0.09 : P;
  const bottom = f.tall ? H * 0.86 : H - P;
  f.add("text", "brief", left, top, (right - left) * 0.6, f.lines(28), { text: "Market brief", font, size: 28, weight: 800, color: text, uppercase: true, letterSpacing: 120 });
  f.add("text", "date", right - 360 * u, top + 4 * u, 360 * u, f.lines(22), { text: "Mon · 08:30 ET", font: MONO, size: 22, weight: 500, color: soft, align: "right", uppercase: true });
  const ruleY = top + 52 * u;
  f.add("shape", "rule", left, ruleY, right - left, 2 * u, { shape: "rect", fill: "#232a3b" });

  const chips = [
    { name: "btc", label: "BTC +2.4%", up: true },
    { name: "ndx", label: "NDX -0.6%", up: false },
    { name: "gold", label: "Gold +0.3%", up: true },
  ];
  const chipGap = 16 * u;
  const chipW = (right - left - chipGap * 2) / 3;
  const chipH = 56 * u;
  const chipY = ruleY + 26 * u;
  chips.forEach((chip, index) => {
    const x = left + index * (chipW + chipGap);
    f.add("shape", `chip-${chip.name}`, x, chipY, chipW, chipH, { shape: "rect", fill: "#161c2b", radius: 0.25 });
    f.add("shape", `arrow-${chip.name}`, x + 22 * u, chipY + chipH / 2 - 8 * u, 18 * u, 16 * u, { shape: "triangle", fill: chip.up ? green : red, rotation: chip.up ? 0 : 180 });
    f.add("text", `chip-${chip.name}`, x + 52 * u, capsTop(f, chipY + chipH / 2, 22), chipW - 64 * u, f.lines(22), { text: chip.label, font: MONO, size: 22, weight: 600, color: text, uppercase: true });
  });

  const side = 80 * u;
  const rowY = bottom - side;
  byline(f, left, rowY, side, (right - left) * 0.62, { font, size: 30, weight: 700, color: text }, { font: MONO, size: 22, weight: 400, color: soft });
  const visualW = 220 * u;
  f.add("visual", "main", right - visualW, rowY + side / 2 - 28 * u, visualW, 56 * u, { visual: "bars", color: green });

  const captions = { font, size: f.by({ square: 50, portrait: 56, story: 64, landscape: 58 }), weight: 700, color: text, highlight: green, align: "left" as const };
  const titleY = chipY + chipH + 36 * u;
  if (f.wide) {
    const column = (right - left) * 0.46;
    const titleH = f.lines(52, 2, 1.1);
    f.add("title", "main", left, titleY, column, titleH, { font, size: 52, weight: 700, color: text, lineHeight: 1.1 });
    const captionsY = titleY + titleH + 28 * u;
    f.add("captions", "main", left, captionsY, column, rowY - 32 * u - captionsY, captions);
    const x = left + column + P * 0.75;
    const chartH = rowY - 76 * u - titleY;
    f.add("graphic", "chart", x, titleY, right - x, chartH, { art: chartArt((right - x) / chartH, green, "#12352c"), color: green });
    f.add("time", "main", right - 300 * u, titleY + chartH + 8 * u, 300 * u, 30 * u, { font: MONO, size: 20, weight: 500, color: soft, align: "right" });
    return;
  }
  const titleSize = f.by({ square: 44, portrait: 48, story: 56, landscape: 48 });
  const titleH = f.lines(titleSize, 2, 1.1);
  f.add("title", "main", left, titleY, right - left, titleH, { font, size: titleSize, weight: 700, color: text, lineHeight: 1.1 });
  const chartY = titleY + titleH + 32 * u;
  const chartH = f.by({ square: 130, portrait: 190, story: 280, landscape: 190 }) * u;
  f.add("graphic", "chart", left, chartY, right - left, chartH, { art: chartArt((right - left) / chartH, green, "#12352c"), color: green });
  const timeY = chartY + chartH + 8 * u;
  f.add("time", "main", right - 300 * u, timeY, 300 * u, 30 * u, { font: MONO, size: 20, weight: 500, color: soft, align: "right" });
  const captionsY = timeY + 30 * u + 20 * u;
  f.add("captions", "main", left, captionsY, right - left, rowY - 32 * u - captionsY, captions);
});

/** The podcast templates in the order the picker shows them. */
export const PODCAST_TEMPLATES: TemplateChoice[] = [
  studioDark,
  cleanWhite,
  bigCaptions,
  boldQuote,
  neonNight,
  sunrise,
  newsroom,
  minimalMono,
  retroRadio,
  splitPhoto,
  twoGuests,
  bigWaveform,
  pastelCard,
  magazineCover,
  techTalk,
  coffeeChat,
  lecture,
  sportsDesk,
  wellness,
  financeBrief,
];
