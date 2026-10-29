/* Twenty ready-made looks for podcast and live audio clips, in a classic and quietly luxurious manner: jewel and paper
   grounds, gilt rules and ornaments, high-contrast serifs and wide-set capitals, each laid out for every frame shape the
   editor offers. A template is only layers, so once it is picked every part of it can be moved, restyled or deleted,
   and the words on its labels are sample copy for the user to change. Free of the DOM, so it can be tested on its own. */
import { FRAME_SIZES, type Art, type Layer, type LayerKind, type Layout, type Page, type Paint, type Template } from "@drkxbt/audiogram";
import {
  archBorder, beadRing, border, cartouche, crown, decoCorner, decoFan, decoWings, divider, fleurDeLis, flourishCorner, hedera, laurelSprig, laurelWreath,
  marbleVeins, ribbonMic, rings, rosette, scrollDivider, sparkles, spineBand, sunburst, taperedRule, trellis, waxSeal, type BorderStyle,
} from "./ornaments.js";

/** A design the user can start a clip from, laid out for whichever frame shape they picked. */
export interface TemplateChoice {
  id: string;
  name: string;
  make(layout: Layout): Template;
}

type Style = Partial<Omit<Layer, "id" | "kind" | "x" | "y" | "w" | "h">>;

// Places in THEMES. A template sets every colour it can, but the theme still paints the avatar when there is no photo
// and the words of a caption not yet said, so each template names a theme whose muted colour reads on its page.
const INK = 0;
const PAPER = 1;
const MINT = 2;
const DUSK = 3;
const EMBER = 4;

// The painter lays a metal across a layer's box as polished light; a caption's highlight stays a flat colour, since
// the word on it takes black or white by how light it is.
const GOLD = "metal:gold";
const ROSE = "metal:rose";
const SILVER = "metal:silver";
const BRONZE = "metal:bronze";
const CHAMPAGNE = "metal:champagne";

const CINZEL = "Cinzel Variable";
const CINZEL_DECO = "Cinzel Decorative";
const CORMORANT = "Cormorant Garamond Variable";
const PLAYFAIR = "Playfair Display Variable";
const BODONI = "Bodoni Moda Variable";
const BASKERVILLE = "Libre Baskerville";
const TENOR = "Tenor Sans";
const MARCELLUS = "Marcellus";
const PRATA = "Prata";
const ITALIANA = "Italiana";
const GILDA = "Gilda Display";
const LIMELIGHT = "Limelight";
const INSTRUMENT = "Instrument Serif";
const PINYON = "Pinyon Script";
const VIBES = "Great Vibes";

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
          // A label's box hugs its words, so it can be picked and moved by what shows of it. Without the speaker's
          // photo, the portrait is their initial on gold rather than on the theme's accent, which suits no design here.
          const fit = kind === "text" ? { autoWidth: true } : kind === "avatar" ? { fill: "metal:gold" } : {};
          layers.push({ id: `${kind}-${name}`, kind, x: x / width, y: y / height, w: w / width, h: h / height, rotation: 0, opacity: 1, ...fit, ...style });
        },
        lines: (size, count = 1, spacing = 1.15) => size * unit * spacing * count,
      });
      return { layers, page: { ...page }, theme };
    },
  };
}

/** The part of the frame words keep to: the margin all round, and on a story the bands the apps cover at top and foot. */
function area(f: Frame, inset = 1) {
  const left = f.pad * inset;
  const top = f.tall ? f.height * 0.1 : f.pad * inset;
  const bottom = f.tall ? f.height * 0.85 : f.height - f.pad * inset;
  return { left, right: f.width - left, top, bottom, cx: f.width / 2, w: f.width - left * 2 };
}

/** A run across the frame for a stack of blocks: its left edge and its width. */
interface Column {
  x: number;
  w: number;
}

/** Part of a stack: its height, the space before it, and how it lays itself down once it knows where it starts. A
 *  flexible block takes a share of the height the others leave, by its weight. */
interface Block {
  h: number;
  gap: number;
  flex?: number;
  draw(y: number, h: number): void;
}

/** Blocks laid down a column from `top` to `bottom`; the height left over goes to the flexible ones, or above and
 *  below the whole stack when none is, so it sits in the middle. */
function stack(top: number, bottom: number, blocks: Array<Block | false>): void {
  const list = blocks.filter((block): block is Block => Boolean(block));
  const used = list.reduce((sum, block) => sum + block.h + block.gap, 0);
  const spare = Math.max(0, bottom - top - used);
  const weight = list.reduce((sum, block) => sum + (block.flex ?? 0), 0);
  let y = top + (weight ? 0 : spare / 2);
  for (const block of list) {
    y += block.gap;
    const h = block.h + (weight ? (spare * (block.flex ?? 0)) / weight : 0);
    block.draw(y, h);
    y += h;
  }
}

/** Room that soaks up a share of what the stack leaves over, to hold the parts round it apart. */
function space(flex = 1): Block {
  return { h: 0, gap: 0, flex, draw: () => {} };
}

/** One line of a label across the column, centred unless the style says otherwise. */
function label(f: Frame, c: Column, name: string, text: string, style: Style, gap = 0): Block {
  const h = f.lines(style.size ?? 24, 1, style.lineHeight ?? 1.25);
  return { h, gap: gap * f.unit, draw: (y) => f.add("text", name, c.x, y, c.w, h, { text, align: "center", lineHeight: 1.25, ...style }) };
}

/** The clip's title, room for `count` lines of it. */
function heading(f: Frame, c: Column, style: Style, count = 2, gap = 0): Block {
  const h = f.lines(style.size ?? 50, count, style.lineHeight ?? 1.15);
  return { h, gap: gap * f.unit, draw: (y) => f.add("title", "main", c.x, y, c.w, h, { align: "center", ...style }) };
}

/** A drawing `w` design pixels wide, centred on `cx`, as tall as its own shape makes it. */
function ornament(f: Frame, cx: number, name: string, art: Art, w: number, style: Style, gap = 0): Block {
  const width = w * f.unit;
  const h = (width * art.h) / art.w;
  return { h, gap: gap * f.unit, draw: (y) => f.add("graphic", name, cx - width / 2, y, width, h, { art, ...style }) };
}

/** A fine straight rule `w` design pixels long, centred on `cx`. */
function rule(f: Frame, cx: number, name: string, w: number, paint: Paint, weight = 1.5, gap = 0): Block {
  const h = 10 * f.unit;
  return { h, gap: gap * f.unit, draw: (y) => f.add("shape", name, cx - (w * f.unit) / 2, y, w * f.unit, h, { shape: "line", fill: paint, strokeWidth: weight }) };
}

/** A rule down the frame, for the seam between two columns. */
function upright(f: Frame, name: string, x: number, top: number, bottom: number, paint: Paint, opacity = 1): void {
  f.add("shape", name, x - 0.75 * f.unit, top, 1.5 * f.unit, bottom - top, { shape: "rect", fill: paint, opacity });
}

interface CameoStyle {
  /** A solid rim round the photo, and how thick it is. */
  rim?: Paint;
  rimWidth?: number;
  /** A drawing round it, `scale` times as wide as the photo. */
  halo?: Art;
  scale?: number;
  haloColor?: Paint;
  loop?: Style["loop"];
}

/** How much height a cameo of a photo `d` design pixels across takes, its rim and its drawing included. */
function cameoHeight(f: Frame, d: number, style: CameoStyle): number {
  const rim = d + (style.rimWidth ?? 6) * 2 * (style.rim ? 1 : 0);
  const halo = style.halo ? d * (style.scale ?? 1.36) * (style.halo.h / style.halo.w) : 0;
  return Math.max(rim, halo) * f.unit;
}

/** The speaker's photo framed as a cameo centred on a point: the drawing round it first, then its rim, then the photo,
 *  all turning slowly together when they loop. */
function cameoAt(f: Frame, cx: number, cy: number, d: number, style: CameoStyle): void {
  const side = d * f.unit;
  const motion: Style = style.loop ? { loop: style.loop } : {};
  if (style.halo) {
    const w = side * (style.scale ?? 1.36);
    const h = (w * style.halo.h) / style.halo.w;
    f.add("graphic", "halo", cx - w / 2, cy - h / 2, w, h, { art: style.halo, color: style.haloColor ?? GOLD, ...motion });
  }
  if (style.rim) {
    const r = side / 2 + (style.rimWidth ?? 6) * f.unit;
    f.add("shape", "rim", cx - r, cy - r, r * 2, r * 2, { shape: "ellipse", fill: style.rim, ...motion });
  }
  f.add("avatar", "main", cx - side / 2, cy - side / 2, side, side, motion);
}

function cameo(f: Frame, cx: number, d: number, style: CameoStyle, gap = 0): Block {
  const h = cameoHeight(f, d, style);
  return { h, gap: gap * f.unit, draw: (y) => cameoAt(f, cx, y + h / 2, d, style) };
}

/** The speaker's name and handle, one over the other. */
function names(f: Frame, c: Column, name: Style, handle: Style | null, gap = 0): Block {
  const nameH = f.lines(name.size ?? 30, 1, 1.35);
  const handleH = handle ? f.lines(handle.size ?? 22, 1, 1.35) : 0;
  return {
    h: nameH + handleH,
    gap: gap * f.unit,
    draw: (y) => {
      f.add("name", "main", c.x, y, c.w, nameH, { align: "center", ...name });
      if (handle) f.add("handle", "main", c.x, y + nameH, c.w, handleH, { align: "center", ...handle });
    },
  };
}

/** The photo with the name over the handle beside it, as one row `w` wide from `x`. */
function byline(f: Frame, x: number, w: number, d: number, name: Style, handle: Style, frame: CameoStyle = {}, gap = 0): Block {
  const h = cameoHeight(f, d, frame);
  return {
    h,
    gap: gap * f.unit,
    draw: (y) => {
      cameoAt(f, x + h / 2, y + h / 2, d, frame);
      const nameH = f.lines(name.size ?? 26, 1, 1.4);
      const handleH = f.lines(handle.size ?? 22, 1, 1.3);
      const top = y + (h - nameH - handleH) / 2;
      const textX = x + h + 20 * f.unit;
      f.add("name", "main", textX, top, x + w - textX, nameH, { ...name, align: "left" });
      f.add("handle", "main", textX, top + nameH, x + w - textX, handleH, { ...handle, align: "left" });
    },
  };
}

/** The captions, room for `count` lines; a flexible one also takes a share of the spare height. */
function captions(f: Frame, c: Column, style: Style, count = 3, gap = 0, flex = 0): Block {
  // A hair over the lines asked for, so the painter's count of the lines that fit never rounds one away.
  const h = f.lines(style.size ?? 60, count + 0.1, style.lineHeight ?? 1.34);
  return { h, gap: gap * f.unit, flex, draw: (y, height) => f.add("captions", "main", c.x, y, c.w, height, { align: "center", ...style }) };
}

/** The sound, `w` by `h` design pixels, centred on `cx`. */
function sound(f: Frame, cx: number, w: number, h: number, style: Style, gap = 0): Block {
  const width = w * f.unit;
  return { h: h * f.unit, gap: gap * f.unit, draw: (y) => f.add("visual", "main", cx - width / 2, y, width, h * f.unit, { visual: "bars", ...style }) };
}

/** The time through the clip, on one line. */
function clock(f: Frame, c: Column, style: Style, gap = 0): Block {
  const h = f.lines(style.size ?? 20, 1, 1.4);
  return { h, gap: gap * f.unit, draw: (y) => f.add("time", "main", c.x, y, c.w, h, { align: "center", ...style }) };
}

/** The links the user gave, on one line. */
function links(f: Frame, c: Column, style: Style, gap = 0): Block {
  const h = f.lines(style.size ?? 20, 1, 1.4);
  return { h, gap: gap * f.unit, draw: (y) => f.add("links", "main", c.x, y, c.w, h, { align: "center", ...style }) };
}

/** A ruled border all round the frame, `inset` design pixels in from its edges. */
function frameBorder(f: Frame, inset: number, style: BorderStyle, color: Paint, opacity = 1): void {
  const i = inset * f.unit;
  const w = f.width - i * 2;
  const h = f.height - i * 2;
  f.add("graphic", "border", i, i, w, h, { art: border(Math.round(w), Math.round(h), style), color, opacity });
}

/** A corner drawing in each corner of a box, turned over for each, `size` design pixels square. */
function corners(f: Frame, art: Art, x: number, y: number, w: number, h: number, size: number, style: Style): void {
  const s = size * f.unit;
  f.add("graphic", "corner-tl", x, y, s, s, { art, ...style });
  f.add("graphic", "corner-tr", x + w - s, y, s, s, { art, flipX: true, ...style });
  f.add("graphic", "corner-bl", x, y + h - s, s, s, { art, flipY: true, ...style });
  f.add("graphic", "corner-br", x + w - s, y + h - s, s, s, { art, flipX: true, flipY: true, ...style });
}

/** The column a stack runs down, the full width of the area or a share of it. */
function columnOf(left: number, right: number): Column {
  return { x: left, w: right - left };
}

/** A label on the left of a row and its partner on the right, sharing a line. */
function pair(f: Frame, c: Column, ids: [string, string], texts: [string, string], style: Style, gap = 0): Block {
  const h = f.lines(style.size ?? 20, 1, 1.25);
  return {
    h,
    gap: gap * f.unit,
    draw: (y) => {
      f.add("text", ids[0], c.x, y, c.w / 2, h, { text: texts[0], align: "left", lineHeight: 1.25, ...style });
      f.add("text", ids[1], c.x + c.w / 2, y, c.w / 2, h, { text: texts[1], align: "right", lineHeight: 1.25, ...style });
    },
  };
}

/** Navy and gold for a royal warrant: a crown over the speaker set in a cameo of beads, a stepped double border. */
const royalCrest = template("royal-crest", "Royal Crest", { color: "#17284d", to: "#080f22", angle: 180 }, DUSK, (f) => {
  const a = area(f);
  const ivory = "#f3ead7";
  const soft = "#9da9c6";
  frameBorder(f, f.pad * 0.36, { gap: 12, outer: 2, inner: 1, corner: "step", cut: 30 }, GOLD, 0.9);
  const kicker: Style = { font: CINZEL, size: 22, weight: 600, color: GOLD, uppercase: true, letterSpacing: 420, enter: "fade" };
  const title: Style = { font: CINZEL, size: f.by({ square: 44, portrait: 52, story: 52, landscape: 54 }), weight: 600, color: GOLD, lineHeight: 1.14, letterSpacing: 30, enter: "glide", loop: "shimmer" };
  const name: Style = { font: CINZEL, size: 28, weight: 600, color: ivory, letterSpacing: 80 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: CORMORANT, size: f.by({ square: 68, portrait: 78, story: 90, landscape: 76 }), weight: 700, color: ivory, highlight: "#e2c27a", lineHeight: 1.28 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 5, halo: beadRing(), scale: 1.34, loop: "slowZoom" };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.38);
    const right = columnOf(f.width * 0.44, a.right - 40);
    stack(a.top, a.bottom, [ornament(f, left.x + left.w / 2, "crown", crown(), 150, { color: GOLD, enter: "fade" }), cameo(f, left.x + left.w / 2, 280, frame, 30), names(f, left, name, handle, 28)]);
    upright(f, "seam", f.width * 0.41, a.top + 40, a.bottom - 40, GOLD, 0.55);
    stack(a.top, a.bottom, [
      label(f, right, "kicker", "Episode XII", kicker),
      heading(f, right, title, 2, 18),
      ornament(f, right.x + right.w / 2, "divider", divider(), 420, { color: GOLD }, 18),
      space(), captions(f, right, words, 3, 18), space(),
      sound(f, right.x + right.w / 2, 520, 70, { color: GOLD }, 18),
      clock(f, right, time, 12),
    ]);
    return;
  }
  const c = columnOf(a.left + 20, a.right - 20);
  stack(a.top, a.bottom, [
    ornament(f, a.cx, "crown", crown(), f.by({ square: 104, portrait: 132, story: 168, landscape: 0 }), { color: GOLD, enter: "fade" }),
    label(f, c, "kicker", "Episode XII", kicker, 18),
    heading(f, c, title, 2, 12),
    cameo(f, a.cx, f.by({ square: 112, portrait: 168, story: 236, landscape: 0 }), frame, f.by({ square: 22, portrait: 34, story: 52, landscape: 0 })),
    names(f, c, name, handle, 18),
    space(), captions(f, c, words, 3, f.by({ square: 16, portrait: 26, story: 40, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 360, portrait: 420, story: 480, landscape: 0 }), f.by({ square: 48, portrait: 64, story: 84, landscape: 0 }), { color: GOLD }, 16),
    clock(f, c, time, 10),
  ]);
});

/** A slate gallery wall and a gilt picture frame round the words, its corners cut in, a jewel in each. */
const gildedFrame = template("gilded-frame", "Gilded Frame", { color: "#252e38", to: "#11161c", angle: 180 }, DUSK, (f) => {
  const a = area(f);
  const ivory = "#f1ead9";
  const soft = "#a3adb8";
  const kicker: Style = { font: CINZEL, size: 22, weight: 600, color: GOLD, uppercase: true, letterSpacing: 400 };
  const title: Style = { font: PLAYFAIR, size: f.by({ square: 46, portrait: 54, story: 54, landscape: 56 }), weight: 500, color: ivory, lineHeight: 1.12, enter: "glide" };
  const name: Style = { font: PLAYFAIR, size: 28, weight: 600, color: ivory };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: PLAYFAIR, size: f.by({ square: 60, portrait: 66, story: 76, landscape: 64 }), weight: 500, color: ivory, highlight: "#e8d5a3", lineHeight: 1.32 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 4 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };
  const gilt = (x: number, y: number, w: number, h: number) => {
    f.add("graphic", "frame", x, y, w, h, { art: border(Math.round(w), Math.round(h), { gap: 16, outer: 7, inner: 1.5, corner: "round", cut: 34, jewels: "corners" }), color: GOLD, enter: "iris" });
  };

  if (f.wide) {
    const head = columnOf(a.left, a.right);
    const titleH = f.lines(title.size!, 1, 1.12);
    f.add("text", "kicker", head.x, a.top, head.w, f.lines(19, 1, 1.25), { text: "Episode XII", align: "center", lineHeight: 1.25, ...kicker });
    f.add("title", "main", head.x, a.top + 44, head.w, titleH, { align: "center", ...title });
    const frameY = a.top + 44 + titleH + 36;
    const frameH = a.bottom - frameY;
    const frameX = a.left + 60;
    const frameW = a.w - 120;
    gilt(frameX, frameY, frameW, frameH);
    const inside = columnOf(frameX + 110, frameX + frameW - 110);
    const side = 300;
    stack(frameY + 60, frameY + frameH - 60, [cameo(f, inside.x + side / 2, 150, frame), names(f, columnOf(inside.x, inside.x + side), name, handle, 18), sound(f, inside.x + side / 2, 240, 50, { color: CHAMPAGNE }, 26), clock(f, columnOf(inside.x, inside.x + side), time, 8)]);
    const words2 = columnOf(inside.x + side + 70, inside.x + inside.w);
    stack(frameY + 60, frameY + frameH - 60, [space(), captions(f, words2, words, 4), space()]);
    return;
  }
  const c = columnOf(a.left, a.right);
  const kickerH = f.lines(19, 1, 1.25);
  const titleH = f.lines(title.size!, 2, 1.12);
  f.add("text", "kicker", c.x, a.top, c.w, kickerH, { text: "Episode XII", align: "center", lineHeight: 1.25, ...kicker });
  f.add("title", "main", c.x, a.top + kickerH + 14, c.w, titleH, { align: "center", ...title });
  const frameY = a.top + kickerH + 14 + titleH + f.by({ square: 26, portrait: 36, story: 52, landscape: 0 });
  const frameH = a.bottom - frameY;
  const frameX = a.left - 10;
  const frameW = a.w + 20;
  gilt(frameX, frameY, frameW, frameH);
  const inside = columnOf(frameX + 80, frameX + frameW - 80);
  stack(frameY + f.by({ square: 56, portrait: 70, story: 96, landscape: 0 }), frameY + frameH - f.by({ square: 50, portrait: 64, story: 90, landscape: 0 }), [
    cameo(f, a.cx, f.by({ square: 96, portrait: 150, story: 220, landscape: 0 }), frame),
    names(f, inside, name, handle, 14),
    ornament(f, a.cx, "rule", taperedRule(), 300, { color: GOLD }, f.by({ square: 14, portrait: 24, story: 36, landscape: 0 })),
    space(), captions(f, inside, words, 3, 14), space(),
    sound(f, a.cx, f.by({ square: 300, portrait: 360, story: 420, landscape: 0 }), f.by({ square: 40, portrait: 54, story: 70, landscape: 0 }), { color: CHAMPAGNE }, 14),
    clock(f, inside, time, 8),
  ]);
});

/** A green salon papered in a gilt trellis: a script greeting, the words on a quiet panel framed in gold. */
const emeraldSalon = template("emerald-salon", "Emerald Salon", { color: "#0f4d3c", to: "#06271e", angle: 180 }, MINT, (f) => {
  const a = area(f);
  const ivory = "#f4ecd8";
  const soft = "#9fcbb8";
  f.add("graphic", "trellis", 0, 0, f.width, f.height, { art: trellis(f.width, f.height, f.by({ square: 96, portrait: 96, story: 110, landscape: 110 })), color: GOLD, opacity: 0.1 });
  const script: Style = { font: PINYON, size: f.by({ square: 58, portrait: 66, story: 78, landscape: 70 }), color: GOLD, lineHeight: 1.3, enter: "fade" };
  const title: Style = { font: BODONI, size: f.by({ square: 44, portrait: 50, story: 50, landscape: 42 }), weight: 600, color: ivory, lineHeight: 1.12, uppercase: true, letterSpacing: 60, enter: "glide" };
  const name: Style = { font: BODONI, size: 27, weight: 600, color: ivory, uppercase: true, letterSpacing: 120 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 52, portrait: 60, story: 66, landscape: 56 }), weight: 700, color: ivory, highlight: "#e2c27a", lineHeight: 1.4 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 4, halo: rings([196, 2], [182, 1]), scale: 1.3 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };
  const panel = (x: number, y: number, w: number, h: number) => {
    f.add("shape", "panel", x, y, w, h, { shape: "rect", fill: "#0a3a2d", stroke: GOLD, strokeWidth: 2 });
    f.add("graphic", "panel-rule", x + 12, y + 12, w - 24, h - 24, { art: border(Math.round(w - 24), Math.round(h - 24), { gap: 0, outer: 1 }), color: GOLD, opacity: 0.7 });
  };

  if (f.wide) {
    const left = columnOf(a.left, f.width * 0.42);
    stack(a.top, a.bottom, [
      label(f, left, "script", "In conversation", script),
      heading(f, left, title, 2, 6),
      cameo(f, left.x + left.w / 2, 190, frame, 36),
      names(f, left, name, handle, 20),
      clock(f, left, time, 14),
    ]);
    const px = f.width * 0.47;
    const pw = a.right - px;
    panel(px, a.top, pw, a.bottom - a.top);
    const inside = columnOf(px + 70, px + pw - 70);
    stack(a.top + 60, a.bottom - 50, [space(), captions(f, inside, words, 4), space(), sound(f, inside.x + inside.w / 2, 480, 64, { color: GOLD }, 30)]);
    return;
  }
  const c = columnOf(a.left, a.right);
  const panelGap = f.by({ square: 22, portrait: 30, story: 44, landscape: 0 });
  const panelH = f.by({ square: 300, portrait: 380, story: 560, landscape: 0 });
  stack(a.top, a.bottom, [
    label(f, c, "script", "In conversation", script),
    heading(f, c, title, 2, 2),
    cameo(f, a.cx, f.by({ square: 100, portrait: 140, story: 200, landscape: 0 }), frame, f.by({ square: 20, portrait: 30, story: 46, landscape: 0 })),
    names(f, c, name, handle, 14),
    {
      h: panelH,
      gap: panelGap,
      flex: 1,
      draw: (y, h) => {
        panel(a.left, y, a.w, h);
        const inside = columnOf(a.left + 56, a.right - 56);
        stack(y + 36, y + h - 30, [space(), captions(f, inside, words, 3), space(), sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 40, portrait: 52, story: 70, landscape: 0 }), { color: GOLD }, 14)]);
      },
    },
    clock(f, c, time, 14),
  ]);
});

/** A wine cellar's medal: oxblood, rose gold, the speaker set in a scalloped rosette between two laurel sprigs. */
const bordeaux = template("bordeaux", "Bordeaux", { color: "#5c1424", to: "#2a0810", angle: 180 }, EMBER, (f) => {
  const a = area(f);
  const ivory = "#f7ebe4";
  const soft = "#d9a99b";
  frameBorder(f, f.pad * 0.4, { gap: 10, outer: 1.5, inner: 1, corner: "round", cut: 40 }, ROSE, 0.85);
  const kicker: Style = { font: TENOR, size: 22, color: ROSE, uppercase: true, letterSpacing: 460 };
  const title: Style = { font: PRATA, size: f.by({ square: 44, portrait: 52, story: 52, landscape: 52 }), color: ivory, lineHeight: 1.18, enter: "glide" };
  const name: Style = { font: PRATA, size: 28, color: ivory, letterSpacing: 40 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: PRATA, size: f.by({ square: 56, portrait: 64, story: 74, landscape: 62 }), color: ivory, highlight: "#efc6b4", lineHeight: 1.36 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };
  // The rosette's hole is a little over half its width, so the photo sits just inside its inner ring; a sprig of laurel
  // reaches out from each side of it, as far as `room` allows.
  const medal = (cx: number, d: number, room: number): Block => {
    const w = d / 0.52;
    const sprig = laurelSprig();
    return {
      h: w * f.unit,
      gap: 0,
      draw: (y) => {
        const sw = Math.min(w * 0.9, (room - w) / 2 / 0.92);
        const sh = (sw * sprig.h) / sprig.w;
        const cy = y + (w * f.unit) / 2;
        f.add("graphic", "sprig-left", cx - w / 2 - sw * 0.92, cy - sh / 2 + w * 0.12, sw, sh, { art: sprig, color: ROSE, flipX: true });
        f.add("graphic", "sprig-right", cx + w / 2 - sw * 0.08, cy - sh / 2 + w * 0.12, sw, sh, { art: sprig, color: ROSE });
        cameoAt(f, cx, cy, d, { halo: rosette(), scale: 1 / 0.52, haloColor: ROSE, loop: "slowZoom" });
      },
    };
  };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.42);
    const right = columnOf(f.width * 0.46, a.right - 50);
    stack(a.top, a.bottom, [medal(left.x + left.w / 2, 190, left.w), names(f, left, name, handle, 34)]);
    stack(a.top, a.bottom, [
      label(f, right, "kicker", "Vintage edition", kicker),
      heading(f, right, title, 2, 16),
      ornament(f, right.x + right.w / 2, "rule", taperedRule(), 380, { color: ROSE }, 14),
      space(), captions(f, right, words, 3, 16), space(),
      sound(f, right.x + right.w / 2, 480, 64, { color: ROSE }, 16),
      clock(f, right, time, 10),
    ]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "Vintage edition", kicker),
    heading(f, c, title, 2, 14),
    { ...medal(a.cx, f.by({ square: 104, portrait: 150, story: 210, landscape: 0 }), c.w), gap: f.by({ square: 18, portrait: 30, story: 48, landscape: 0 }) },
    names(f, c, name, handle, 14),
    space(), captions(f, c, words, 3, f.by({ square: 12, portrait: 24, story: 40, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 44, portrait: 60, story: 80, landscape: 0 }), { color: ROSE }, 14),
    clock(f, c, time, 10),
  ]);
});

/** A jazz-age poster in black and gold: a fan rising behind the title, stepped corners, the title in a deco face. */
const gatsbyDeco = template("gatsby-deco", "Gatsby Deco", { color: "#141210", to: "#070707", angle: 180 }, DUSK, (f) => {
  const a = area(f);
  const ivory = "#f2e8d2";
  const soft = "#b3a68a";
  const edge = f.pad * 0.36;
  corners(f, decoCorner(), edge, edge, f.width - edge * 2, f.height - edge * 2, f.by({ square: 150, portrait: 170, story: 200, landscape: 170 }), { color: GOLD });
  const kicker: Style = { font: TENOR, size: 22, color: GOLD, uppercase: true, letterSpacing: 520 };
  const title: Style = { font: LIMELIGHT, size: f.by({ square: 48, portrait: 50, story: 50, landscape: 48 }), color: GOLD, uppercase: true, lineHeight: 1.12, letterSpacing: 60, enter: "unfold", loop: "shimmer" };
  const name: Style = { font: TENOR, size: 24, color: ivory, uppercase: true, letterSpacing: 300 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 200 };
  const words: Style = { font: MARCELLUS, size: f.by({ square: 60, portrait: 66, story: 76, landscape: 64 }), color: ivory, highlight: "#e2c27a", lineHeight: 1.34 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 4, halo: rings([196, 2.5], [184, 1]), scale: 1.28 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 200 };

  if (f.wide) {
    const left = columnOf(a.left + 80, f.width * 0.4);
    const right = columnOf(f.width * 0.45, a.right - 80);
    stack(a.top, a.bottom, [ornament(f, left.x + left.w / 2, "fan", decoFan(), 420, { color: GOLD, enter: "iris" }), cameo(f, left.x + left.w / 2, 210, frame, 28), names(f, left, name, handle, 24)]);
    upright(f, "seam", f.width * 0.425, a.top + 60, a.bottom - 60, GOLD, 0.5);
    stack(a.top, a.bottom, [
      label(f, right, "kicker", "Episode XII", kicker),
      heading(f, right, title, 2, 16),
      rule(f, right.x + right.w / 2, "rule", 160, GOLD, 2, 16),
      space(), captions(f, right, words, 3, 18), space(),
      sound(f, right.x + right.w / 2, 480, 64, { color: GOLD }, 18),
      clock(f, right, time, 10),
    ]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  const fanW = f.by({ square: 360, portrait: 460, story: 600, landscape: 0 });
  stack(a.top, a.bottom, [
    ornament(f, a.cx, "fan", decoFan(), fanW, { color: GOLD, enter: "iris" }),
    label(f, c, "kicker", "Episode XII", kicker, 18),
    heading(f, c, title, 2, 14),
    cameo(f, a.cx, f.by({ square: 92, portrait: 132, story: 190, landscape: 0 }), frame, f.by({ square: 20, portrait: 32, story: 48, landscape: 0 })),
    names(f, c, name, handle, 16),
    space(), captions(f, c, words, 3, f.by({ square: 10, portrait: 22, story: 36, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 44, portrait: 58, story: 78, landscape: 0 }), { color: GOLD }, 14),
    clock(f, c, time, 10),
  ]);
});

/** A book's title page pulled on ivory: black ink, an oxblood accent, a printer's leaf and a fine double rule. */
const ivoryLetterpress = template("ivory-letterpress", "Ivory Letterpress", { color: "#f5efe3", to: "#ebe2d1", angle: 180 }, PAPER, (f) => {
  const a = area(f);
  const ink = "#1c1915";
  const oxblood = "#7b1e28";
  const soft = "#6f665b";
  frameBorder(f, f.pad * 0.42, { gap: 7, outer: 2.5, inner: 1 }, ink, 0.9);
  const kicker: Style = { font: BODONI, size: 22, weight: 600, color: oxblood, uppercase: true, letterSpacing: 420 };
  const title: Style = { font: BODONI, size: f.by({ square: 56, portrait: 66, story: 66, landscape: 60 }), weight: 600, color: ink, lineHeight: 1.06, enter: "ascend" };
  const name: Style = { font: BODONI, size: 24, weight: 600, color: ink, uppercase: true, letterSpacing: 220 };
  const handle: Style = { font: BASKERVILLE, size: 22, color: soft };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 50, portrait: 56, story: 64, landscape: 54 }), color: ink, highlight: oxblood, lineHeight: 1.45 };
  const frame: CameoStyle = { halo: rings([194, 3], [178, 1]), scale: 1.3, haloColor: ink };
  const time: Style = { font: BODONI, size: 20, weight: 500, color: soft, letterSpacing: 200 };

  if (f.wide) {
    const left = columnOf(a.left + 60, f.width * 0.47);
    const right = columnOf(f.width * 0.53, a.right - 60);
    stack(a.top, a.bottom, [
      label(f, left, "kicker", "Volume XII", kicker),
      heading(f, left, title, 3, 22),
      ornament(f, left.x + left.w / 2, "leaf", hedera(), 96, { color: oxblood }, 26),
      cameo(f, left.x + left.w / 2, 120, frame, 30),
      names(f, left, name, handle, 16),
    ]);
    upright(f, "seam", f.width * 0.5, a.top + 30, a.bottom - 30, ink, 0.6);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 5), space(), sound(f, right.x + right.w / 2, 420, 52, { color: ink }, 26), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 40, a.right - 40);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "Volume XII", kicker),
    heading(f, c, title, 2, 20),
    ornament(f, a.cx, "leaf", hedera(), f.by({ square: 84, portrait: 96, story: 112, landscape: 0 }), { color: oxblood }, 20),
    space(), captions(f, c, words, 3, f.by({ square: 16, portrait: 26, story: 40, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 300, portrait: 360, story: 420, landscape: 0 }), f.by({ square: 36, portrait: 48, story: 64, landscape: 0 }), { color: ink }, 16),
    cameo(f, a.cx, f.by({ square: 76, portrait: 104, story: 140, landscape: 0 }), frame, f.by({ square: 20, portrait: 30, story: 50, landscape: 0 })),
    names(f, c, name, handle, 12),
    clock(f, c, time, 8),
  ]);
});

/** Honed marble and gold leaf: grey veins under a double gilt border, capitals cut in charcoal. */
const marbleGold = template("marble-gold", "Marble and Gold", { color: "#efece7", to: "#d6d1c9", angle: 160 }, PAPER, (f) => {
  const a = area(f);
  const charcoal = "#26231f";
  const soft = "#6e675f";
  // Gold leaf's highlights vanish into pale stone, so the small gilt parts take a deeper, flat gold.
  const deepGold = "#9a7b3c";
  f.add("graphic", "veins", 0, 0, f.width, f.height, { art: marbleVeins(f.width, f.height, f.by({ square: 11, portrait: 23, story: 37, landscape: 53 })), color: "#8d867d", opacity: 0.32 });
  frameBorder(f, f.pad * 0.38, { gap: 12, outer: 3, inner: 1.5, jewels: "sides" }, GOLD);
  const kicker: Style = { font: CINZEL, size: 22, weight: 700, color: "#8a6a2f", uppercase: true, letterSpacing: 400 };
  const title: Style = { font: CINZEL, size: f.by({ square: 46, portrait: 54, story: 54, landscape: 54 }), weight: 600, color: charcoal, lineHeight: 1.14, letterSpacing: 20, enter: "glide" };
  const name: Style = { font: CINZEL, size: 26, weight: 700, color: charcoal, letterSpacing: 80 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: CORMORANT, size: f.by({ square: 66, portrait: 76, story: 84, landscape: 74 }), weight: 700, color: charcoal, highlight: charcoal, lineHeight: 1.28 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 6 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };

  if (f.wide) {
    const left = columnOf(a.left + 60, f.width * 0.38);
    const right = columnOf(f.width * 0.44, a.right - 60);
    stack(a.top, a.bottom, [cameo(f, left.x + left.w / 2, 260, frame), names(f, left, name, handle, 28), clock(f, left, time, 14)]);
    upright(f, "seam", f.width * 0.41, a.top + 40, a.bottom - 40, GOLD);
    stack(a.top, a.bottom, [
      label(f, right, "kicker", "Episode XII", kicker),
      heading(f, right, title, 2, 16),
      ornament(f, right.x + right.w / 2, "divider", divider(), 400, { color: deepGold }, 16),
      space(), captions(f, right, words, 3, 16), space(),
      sound(f, right.x + right.w / 2, 520, 64, { color: deepGold }, 18),
    ]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "Episode XII", kicker, f.by({ square: 10, portrait: 16, story: 0, landscape: 0 })),
    heading(f, c, title, 2, 14),
    ornament(f, a.cx, "divider", divider(), f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), { color: deepGold }, 16),
    cameo(f, a.cx, f.by({ square: 104, portrait: 150, story: 210, landscape: 0 }), frame, f.by({ square: 22, portrait: 34, story: 54, landscape: 0 })),
    names(f, c, name, handle, 14),
    space(), captions(f, c, words, 3, f.by({ square: 12, portrait: 22, story: 40, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 44, portrait: 58, story: 76, landscape: 0 }), { color: deepGold }, 14),
    clock(f, c, time, 10),
  ]);
});

/** A night at the opera: plum velvet and a gilt proscenium arch, "Tonight" in script above the title. */
const midnightOpera = template("midnight-opera", "Midnight Opera", { color: "#2d0f33", to: "#0c0410", angle: 180 }, DUSK, (f) => {
  const a = area(f);
  const ivory = "#f5ead9";
  const soft = "#bba3c2";
  const script: Style = { font: VIBES, size: f.by({ square: 64, portrait: 74, story: 86, landscape: 76 }), color: GOLD, lineHeight: 1.25, enter: "fade" };
  const title: Style = { font: PLAYFAIR, size: f.by({ square: 42, portrait: 50, story: 50, landscape: 48 }), weight: 600, color: ivory, lineHeight: 1.14, uppercase: true, letterSpacing: 80, enter: "glide" };
  const name: Style = { font: PLAYFAIR, size: 27, weight: 600, color: ivory };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: PLAYFAIR, size: f.by({ square: 56, portrait: 64, story: 74, landscape: 62 }), weight: 500, color: ivory, highlight: "#e2c27a", lineHeight: 1.32 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 4, halo: rings([196, 1.5]), scale: 1.24 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 180 };
  const arch = (x: number, y: number, w: number, h: number) => f.add("graphic", "arch", x, y, w, h, { art: archBorder(Math.round(w), Math.round(h), 14, 2.5), color: GOLD, enter: "curtain" });

  if (f.wide) {
    const aw = 720;
    const ax = a.right - aw - 20;
    arch(ax, a.top - 20, aw, a.bottom - a.top + 20);
    const left = columnOf(a.left + 40, ax - 70);
    stack(a.top, a.bottom, [label(f, left, "script", "Tonight", script), heading(f, left, title, 2, 4), ornament(f, left.x + left.w / 2, "rule", taperedRule(), 360, { color: GOLD }, 22), space(), captions(f, left, words, 3, 22), space(), sound(f, left.x + left.w / 2, 520, 64, { color: GOLD }, 18)]);
    const inside = columnOf(ax + 80, ax + aw - 80);
    stack(a.top + 200, a.bottom - 60, [cameo(f, ax + aw / 2, 250, frame), names(f, inside, name, handle, 26), clock(f, inside, time, 14)]);
    return;
  }
  const archY = f.by({ square: a.top - 24, portrait: a.top - 20, story: a.top - 60, landscape: 0 });
  arch(a.left - 20, archY, a.w + 40, a.bottom + 20 - archY);
  const inside = columnOf(a.left + 40, a.right - 40);
  stack(archY + (a.w + 40) * f.by({ square: 0.2, portrait: 0.22, story: 0.24, landscape: 0 }), a.bottom - 10, [
    label(f, inside, "script", "Tonight", script),
    heading(f, inside, title, 2, 0),
    cameo(f, a.cx, f.by({ square: 92, portrait: 136, story: 196, landscape: 0 }), frame, f.by({ square: 18, portrait: 30, story: 50, landscape: 0 })),
    names(f, inside, name, handle, 14),
    space(), captions(f, inside, words, 3, f.by({ square: 8, portrait: 20, story: 36, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 40, portrait: 54, story: 72, landscape: 0 }), { color: GOLD }, 12),
    clock(f, inside, time, 8),
  ]);
});

/** The wireless age in walnut and bronze: a ribbon microphone under winged capitals, the station's name curved over it. */
const heritageBroadcast = template("heritage-broadcast", "Heritage Broadcast", { color: "#2f2118", to: "#140d09", angle: 180 }, EMBER, (f) => {
  const a = area(f);
  const cream = "#f2e5cd";
  const soft = "#c9a88d";
  frameBorder(f, f.pad * 0.36, { gap: 9, outer: 1.5, inner: 1, corner: "step", cut: 22 }, BRONZE, 0.9);
  const sign: Style = { font: CINZEL, size: f.by({ square: 24, portrait: 26, story: 30, landscape: 26 }), weight: 700, color: BRONZE, uppercase: true, letterSpacing: 300, curve: 26 };
  const title: Style = { font: CINZEL, size: f.by({ square: 42, portrait: 50, story: 50, landscape: 50 }), weight: 600, color: cream, lineHeight: 1.14, letterSpacing: 30, enter: "glide" };
  const name: Style = { font: CINZEL, size: 26, weight: 600, color: cream, letterSpacing: 80 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 50, portrait: 56, story: 66, landscape: 54 }), weight: 700, color: cream, highlight: "#e0b872", lineHeight: 1.42 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 180 };
  const mic = (cx: number, h: number, gap = 0): Block => {
    const art = ribbonMic();
    const micW = (h * art.w) / art.h;
    const wings = decoWings();
    const wingsW = micW * 3.1;
    const wingsH = (wingsW * wings.h) / wings.w;
    return {
      h: h * f.unit,
      gap,
      draw: (y) => {
        f.add("graphic", "wings", cx - wingsW / 2, y + h * 0.18, wingsW, wingsH, { art: wings, color: BRONZE, opacity: 0.8 });
        f.add("graphic", "mic", cx - micW / 2, y, micW, h, { art, color: BRONZE, enter: "rise" });
      },
    };
  };
  const signBlock = (c: Column, gap = 0): Block => {
    const h = f.lines(sign.size!, 1, 2.4);
    return { h, gap, draw: (y) => f.add("text", "sign", c.x, y, c.w, h, { text: "On the wireless", align: "center", lineHeight: 1.25, ...sign }) };
  };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.4);
    const right = columnOf(f.width * 0.46, a.right - 50);
    stack(a.top, a.bottom, [signBlock(left), mic(left.x + left.w / 2, 300, 6), cameo(f, left.x + left.w / 2, 110, { rim: BRONZE, rimWidth: 4 }, 34), names(f, left, name, handle, 14)]);
    upright(f, "seam", f.width * 0.43, a.top + 40, a.bottom - 40, BRONZE, 0.55);
    stack(a.top, a.bottom, [heading(f, right, title, 2), rule(f, right.x + right.w / 2, "rule", 200, BRONZE, 2, 20), space(), captions(f, right, words, 4, 20), space(), sound(f, right.x + right.w / 2, 500, 64, { color: BRONZE }, 18), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  stack(a.top, a.bottom, [
    signBlock(c),
    mic(a.cx, f.by({ square: 150, portrait: 200, story: 270, landscape: 0 }), 4),
    heading(f, c, title, 2, f.by({ square: 18, portrait: 28, story: 40, landscape: 0 })),
    rule(f, a.cx, "rule", 160, BRONZE, 2, 14),
    space(), captions(f, c, words, 3, f.by({ square: 10, portrait: 20, story: 34, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 42, portrait: 56, story: 76, landscape: 0 }), { color: BRONZE }, 12),
    byline(f, a.cx - 190 * f.unit, 380 * f.unit, f.by({ square: 64, portrait: 80, story: 96, landscape: 0 }), name, handle, { rim: BRONZE, rimWidth: 4 }, f.by({ square: 18, portrait: 26, story: 40, landscape: 0 })),
    clock(f, c, time, 12),
  ]);
});

/** Blush stationery sealed in burgundy wax: a rose-gold initial pressed into the seal, the words below in a fine serif. */
const monogram = template("the-monogram", "The Monogram", { color: "#f6ebe6", to: "#ecdcd5", angle: 180 }, PAPER, (f) => {
  const a = area(f);
  const wine = "#4c1826";
  const soft = "#8a6a6f";
  frameBorder(f, f.pad * 0.42, { gap: 0, outer: 1.5 }, ROSE, 0.9);
  const kicker: Style = { font: TENOR, size: 22, color: "#9b5f5a", uppercase: true, letterSpacing: 460 };
  const title: Style = { font: CORMORANT, size: f.by({ square: 54, portrait: 62, story: 64, landscape: 54 }), weight: 600, color: wine, lineHeight: 1.08, enter: "glide" };
  const name: Style = { font: TENOR, size: 21, color: wine, uppercase: true, letterSpacing: 300 };
  const handle: Style = { font: CORMORANT, size: 24, weight: 600, color: soft };
  const words: Style = { font: CORMORANT, size: f.by({ square: 66, portrait: 76, story: 88, landscape: 74 }), weight: 700, color: wine, highlight: wine, lineHeight: 1.26 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 200 };
  const seal = (cx: number, w: number, gap = 0): Block => {
    const side = w * f.unit;
    return {
      h: side,
      gap,
      draw: (y) => {
        f.add("graphic", "seal", cx - side / 2, y, side, side, { art: waxSeal(), color: "#6d1a2a", enter: "pop" });
        const size = Math.round(w * 0.44);
        const h = f.lines(size, 1, 1);
        f.add("text", "initial", cx - side / 2, y + side / 2 - size * f.unit * 0.42, side, h, { text: "E", font: CINZEL_DECO, size, weight: 700, color: ROSE, align: "center", lineHeight: 1 });
      },
    };
  };
  // The speaker signs off at the foot: the photo in a fine rose rim, the name beside it, the row centred in `c`.
  const signature = (c: Column, d: number, gap = 0) => byline(f, c.x + c.w / 2 - 210 * f.unit, 420 * f.unit, d, name, handle, { rim: ROSE, rimWidth: 3 }, gap);

  if (f.wide) {
    const left = columnOf(a.left + 60, f.width * 0.42);
    const right = columnOf(f.width * 0.47, a.right - 60);
    stack(a.top, a.bottom, [seal(left.x + left.w / 2, 240), label(f, left, "kicker", "Private correspondence", kicker, 34), heading(f, left, title, 2, 14), signature(left, 86, 40)]);
    upright(f, "seam", f.width * 0.445, a.top + 60, a.bottom - 60, ROSE, 0.6);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 4), space(), sound(f, right.x + right.w / 2, 460, 56, { color: "#9b5f5a" }, 24), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 40, a.right - 40);
  stack(a.top, a.bottom, [
    seal(a.cx, f.by({ square: 150, portrait: 190, story: 250, landscape: 0 })),
    label(f, c, "kicker", "Private correspondence", kicker, f.by({ square: 20, portrait: 28, story: 40, landscape: 0 })),
    heading(f, c, title, 2, 12),
    space(), captions(f, c, words, 3, f.by({ square: 14, portrait: 24, story: 40, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 300, portrait: 360, story: 420, landscape: 0 }), f.by({ square: 36, portrait: 48, story: 64, landscape: 0 }), { color: "#9b5f5a" }, 14),
    signature(c, f.by({ square: 70, portrait: 82, story: 98, landscape: 0 }), f.by({ square: 22, portrait: 30, story: 46, landscape: 0 })),
    clock(f, c, time, 12),
  ]);
});

/** The evening paper: a masthead between heavy and fine rules, a dateline, the words set as the lead story. */
const gazette = template("the-gazette", "The Gazette", { color: "#efe9dc" }, PAPER, (f) => {
  const a = area(f, 0.8);
  const ink = "#171512";
  const red = "#9b1c1c";
  const soft = "#625b52";
  const mast: Style = { font: BODONI, size: f.by({ square: 112, portrait: 120, story: 128, landscape: 128 }), weight: 800, color: ink, lineHeight: 1.05, letterSpacing: -10 };
  const dateline: Style = { font: BODONI, size: 19, weight: 600, color: ink, uppercase: true, letterSpacing: 260 };
  const kicker: Style = { font: BODONI, size: 22, weight: 700, color: red, uppercase: true, letterSpacing: 300, align: "left" };
  const title: Style = { font: BODONI, size: f.by({ square: 50, portrait: 58, story: 60, landscape: 58 }), weight: 700, color: ink, lineHeight: 1.08, align: "left", enter: "ascend" };
  const name: Style = { font: BODONI, size: 20, weight: 700, color: ink, uppercase: true, letterSpacing: 200, align: "left" };
  const handle: Style = { font: BASKERVILLE, size: 22, color: soft, align: "left" };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 54, portrait: 60, story: 68, landscape: 56 }), color: ink, highlight: red, lineHeight: 1.4, align: "left" };
  const time: Style = { font: BODONI, size: 20, weight: 600, color: soft, uppercase: true, letterSpacing: 200 };
  // An opening quotation mark in the paper's red, hung over the words as a pull quote's would be.
  const quote: Style = { font: BODONI, size: f.by({ square: 110, portrait: 130, story: 150, landscape: 130 }), weight: 800, color: red, align: "left", lineHeight: 0.62 };
  const c = columnOf(a.left, a.right);
  const head: Block[] = [
    label(f, c, "masthead", "The Gazette", mast),
    rule(f, a.cx, "rule-heavy", a.w, ink, 5, 4),
    pair(f, c, ["edition", "issue"], ["Evening edition", "Episode XII"], dateline, 6),
    rule(f, a.cx, "rule-fine", a.w, ink, 1.5, 2),
  ];
  const credit = (col: Column, d: number, gap = 0) => byline(f, col.x, col.w, d, name, handle, { rim: ink, rimWidth: 2 }, gap);

  if (f.wide) {
    const lead = columnOf(a.left, a.left + a.w * 0.64);
    const side = columnOf(lead.x + lead.w + 60, a.right);
    const mastH = head.reduce((sum, block) => sum + block.h + block.gap, 0);
    stack(a.top, a.top + mastH, head);
    const top = a.top + mastH + 34;
    upright(f, "column", lead.x + lead.w + 30, top, a.bottom, ink, 0.7);
    stack(top, a.bottom, [label(f, lead, "kicker", "The interview", kicker), heading(f, lead, title, 2, 8), space(), label(f, lead, "quote", "“", quote), captions(f, lead, words, 2), space(1.4)]);
    stack(top, a.bottom, [credit(side, 80), rule(f, side.x + side.w / 2, "rule-side", side.w, ink, 1, 18), sound(f, side.x + side.w / 2, side.w, 80, { color: ink }, 22), clock(f, side, { ...time, align: "left" }, 12), space(), links(f, side, { ...time, align: "left" })]);
    return;
  }
  stack(a.top, a.bottom, [
    ...head,
    label(f, c, "kicker", "The interview", kicker, f.by({ square: 26, portrait: 34, story: 50, landscape: 0 })),
    heading(f, c, title, 2, 8),
    credit(c, f.by({ square: 60, portrait: 72, story: 86, landscape: 0 }), 18),
    rule(f, a.cx, "rule-story", a.w, ink, 1, 16),
    space(),
    label(f, c, "quote", "“", quote),
    captions(f, c, words, 2),
    space(1.4),
    rule(f, a.cx, "rule-foot", a.w, ink, 1, 10),
    {
      h: f.by({ square: 44, portrait: 56, story: 70, landscape: 0 }) * f.unit,
      gap: 14 * f.unit,
      draw: (y, h) => {
        const w = 360 * f.unit;
        f.add("visual", "main", a.left, y, w, h, { visual: "bars", color: ink });
        f.add("time", "main", a.right - 300 * f.unit, y, 300 * f.unit, h, { ...time, align: "right" });
      },
    },
  ]);
});

/** Royal purple and gold: three fleurs-de-lis over a decorative title, the speaker in a ring of fine gold. */
const imperialPurple = template("imperial-purple", "Imperial Purple", { color: "#3d1764", to: "#16072a", angle: 180 }, DUSK, (f) => {
  const a = area(f);
  const ivory = "#f5ecdb";
  const soft = "#b9a6d6";
  frameBorder(f, f.pad * 0.36, { gap: 10, outer: 2, inner: 1, jewels: "sides" }, GOLD, 0.9);
  const title: Style = { font: CINZEL_DECO, size: f.by({ square: 42, portrait: 50, story: 50, landscape: 50 }), weight: 700, color: GOLD, lineHeight: 1.16, enter: "glide", loop: "shimmer" };
  const kicker: Style = { font: CINZEL, size: 22, weight: 600, color: soft, uppercase: true, letterSpacing: 420 };
  const name: Style = { font: CINZEL, size: 27, weight: 600, color: ivory, letterSpacing: 80 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: CORMORANT, size: f.by({ square: 68, portrait: 78, story: 90, landscape: 76 }), weight: 700, color: ivory, highlight: "#e2c27a", lineHeight: 1.28 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 5, halo: rings([196, 2], [184, 1], [172, 1]), scale: 1.32, loop: "slowZoom" };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };
  const lilies = (cx: number, w: number, gap = 0): Block => {
    const art = fleurDeLis();
    const big = w * f.unit;
    const small = big * 0.62;
    const h = (big * art.h) / art.w;
    return {
      h,
      gap,
      draw: (y) => {
        const smallH = (small * art.h) / art.w;
        f.add("graphic", "lily-left", cx - big * 1.5 - small / 2, y + h - smallH, small, smallH, { art, color: GOLD });
        f.add("graphic", "lily", cx - big / 2, y, big, h, { art, color: GOLD, enter: "rise" });
        f.add("graphic", "lily-right", cx + big * 1.5 - small / 2, y + h - smallH, small, smallH, { art, color: GOLD });
      },
    };
  };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.4);
    const right = columnOf(f.width * 0.45, a.right - 40);
    stack(a.top, a.bottom, [lilies(left.x + left.w / 2, 100), cameo(f, left.x + left.w / 2, 240, frame, 40), names(f, left, name, handle, 30)]);
    upright(f, "seam", f.width * 0.425, a.top + 40, a.bottom - 40, GOLD, 0.5);
    stack(a.top, a.bottom, [label(f, right, "kicker", "Episode XII", kicker), heading(f, right, title, 2, 16), ornament(f, right.x + right.w / 2, "divider", divider(), 400, { color: GOLD }, 16), space(), captions(f, right, words, 3, 16), space(), sound(f, right.x + right.w / 2, 500, 64, { color: GOLD }, 16), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 20, a.right - 20);
  stack(a.top, a.bottom, [
    lilies(a.cx, f.by({ square: 80, portrait: 100, story: 120, landscape: 0 })),
    label(f, c, "kicker", "Episode XII", kicker, 20),
    heading(f, c, title, 2, 12),
    cameo(f, a.cx, f.by({ square: 104, portrait: 150, story: 214, landscape: 0 }), frame, f.by({ square: 20, portrait: 32, story: 50, landscape: 0 })),
    names(f, c, name, handle, 16),
    space(), captions(f, c, words, 3, f.by({ square: 10, portrait: 22, story: 38, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 44, portrait: 58, story: 78, landscape: 0 }), { color: GOLD }, 14),
    clock(f, c, time, 10),
  ]);
});

/** A champagne toast: a warm gold page, a script greeting, sparkles at the corners and bubbles rising. */
const champagneToast = template("champagne-toast", "Champagne Toast", { color: "#f4e9d0", to: "#d9c08e", angle: 165 }, PAPER, (f) => {
  const a = area(f);
  const brown = "#3a2914";
  const soft = "#7a6142";
  const script: Style = { font: VIBES, size: f.by({ square: 60, portrait: 70, story: 82, landscape: 72 }), color: "#8a6420", lineHeight: 1.25, enter: "fade" };
  const title: Style = { font: ITALIANA, size: f.by({ square: 48, portrait: 48, story: 48, landscape: 60 }), color: brown, uppercase: true, lineHeight: 1.12, letterSpacing: 90, enter: "glide" };
  const name: Style = { font: TENOR, size: 22, color: brown, uppercase: true, letterSpacing: 300 };
  // On a page this light, the rule and the sound take a deep flat gold; the polished one would fade into it.
  const deepGold = "#8a6420";
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: GILDA, size: f.by({ square: 60, portrait: 66, story: 76, landscape: 64 }), color: brown, highlight: brown, lineHeight: 1.34 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 5, halo: rings([196, 1.5]), scale: 1.22 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 200 };
  const glint = f.by({ square: 110, portrait: 130, story: 160, landscape: 140 });
  f.add("graphic", "sparkles", a.right - glint * 0.9, a.top - glint * 0.35, glint, glint, { art: sparkles(), color: GOLD, loop: "pulse", speed: 0.5 });
  f.add("graphic", "sparkles-low", a.left - glint * 0.1, a.bottom - glint * 0.65, glint * 0.7, glint * 0.7, { art: sparkles(), color: GOLD, flipX: true, loop: "pulse", speed: 0.4 });
  // A few bubbles drifting up one side, each its own size and pace.
  [[0.08, 0.62, 18], [0.12, 0.5, 11], [0.06, 0.4, 8], [0.92, 0.7, 14], [0.9, 0.56, 9]].forEach(([x, y, r], index) => {
    const side = r * 2 * f.unit;
    f.add("shape", `bubble-${index + 1}`, f.width * x - side / 2, f.height * y, side, side, { shape: "ellipse", fill: "#fffaf0", opacity: 0.55, loop: "float", speed: 0.4 + index * 0.08 });
  });

  if (f.wide) {
    const left = columnOf(a.left + 60, f.width * 0.42);
    const right = columnOf(f.width * 0.46, a.right - 80);
    stack(a.top, a.bottom, [label(f, left, "script", "A toast to", script), heading(f, left, title, 2, 0), ornament(f, left.x + left.w / 2, "rule", taperedRule(), 340, { color: deepGold }, 24), cameo(f, left.x + left.w / 2, 150, frame, 30), names(f, left, name, handle, 18)]);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 4), space(), sound(f, right.x + right.w / 2, 480, 64, { color: deepGold }, 24), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 40, a.right - 40);
  stack(a.top, a.bottom, [
    label(f, c, "script", "A toast to", script),
    heading(f, c, title, 2, 0),
    ornament(f, a.cx, "rule", taperedRule(), f.by({ square: 300, portrait: 340, story: 400, landscape: 0 }), { color: deepGold }, 16),
    space(), captions(f, c, words, 3, f.by({ square: 12, portrait: 22, story: 36, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 40, portrait: 54, story: 72, landscape: 0 }), { color: deepGold }, 12),
    cameo(f, a.cx, f.by({ square: 84, portrait: 116, story: 160, landscape: 0 }), frame, f.by({ square: 20, portrait: 30, story: 46, landscape: 0 })),
    names(f, c, name, handle, 12),
    clock(f, c, time, 8),
  ]);
});

/** A film still in black and silver: a title card over the speaker in a spotlight, the words between two hairlines
 *  running edge to edge like subtitles on the screen, and the speaker billed underneath. */
const noirCinema = template("noir-cinema", "Noir Cinema", { color: "#1e1f23", to: "#050506", angle: 180 }, INK, (f) => {
  const a = area(f);
  const white = "#f2f2f0";
  const soft = "#9a9ca3";
  const kicker: Style = { font: TENOR, size: 22, color: SILVER, uppercase: true, letterSpacing: 520 };
  const title: Style = { font: BODONI, size: f.by({ square: 50, portrait: 50, story: 50, landscape: 56 }), weight: 700, color: SILVER, uppercase: true, lineHeight: 1.08, letterSpacing: 40, enter: "glide", loop: "shimmer" };
  const billing: Style = { font: TENOR, size: 19, color: soft, uppercase: true, letterSpacing: 520 };
  const name: Style = { font: BODONI, size: 30, weight: 600, color: white, uppercase: true, letterSpacing: 240 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 180 };
  const words: Style = { font: INSTRUMENT, size: f.by({ square: 72, portrait: 80, story: 88, landscape: 80 }), color: white, highlight: "#dfe3e8", lineHeight: 1.22 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 220 };
  const spotlight = (cx: number, cy: number, d: number) => {
    const rays = d * 2.4 * f.unit;
    f.add("graphic", "rays", cx - rays / 2, cy - rays / 2, rays, rays, { art: sunburst(), color: SILVER, opacity: 0.24 });
    cameoAt(f, cx, cy, d, { rim: SILVER, rimWidth: 4 });
  };
  const burst = (cx: number, d: number, gap = 0): Block => {
    const h = d * 1.5 * f.unit;
    return { h, gap: gap * f.unit, draw: (y) => spotlight(cx, y + h / 2, d) };
  };
  // The screen: two silver hairlines across the whole frame and the words between them.
  const screen = (c: Column, count: number, inset: number, gap = 0): Block => {
    const lines = captions(f, c, words, count);
    const pad = inset * f.unit;
    const h = lines.h + pad * 2;
    const edge = (name: string, y: number) => f.add("shape", name, 0, y - 4 * f.unit, f.width, 8 * f.unit, { shape: "line", fill: SILVER, strokeWidth: 1.5, opacity: 0.75, enter: "unfold" });
    return {
      h,
      gap: gap * f.unit,
      draw: (y) => {
        edge("screen-top", y);
        edge("screen-foot", y + h);
        lines.draw(y + pad, lines.h);
      },
    };
  };

  if (f.wide) {
    const c = columnOf(a.left, a.right);
    const rowH = 150 * f.unit;
    stack(a.top, a.bottom, [
      label(f, c, "kicker", "The late show", kicker),
      heading(f, c, title, 1, 12),
      space(),
      screen(columnOf(a.left + 80, a.right - 80), 2, 44),
      space(),
      {
        h: rowH,
        gap: 0,
        draw: (y) => {
          spotlight(a.left + 120 * f.unit, y + rowH / 2, 104);
          const x = a.left + 230 * f.unit;
          const billH = f.lines(19, 1, 1.4);
          const nameH = f.lines(30, 1, 1.35);
          const handleH = f.lines(22, 1, 1.3);
          const top = y + (rowH - billH - nameH - handleH) / 2;
          f.add("text", "billing", x, top, 520 * f.unit, billH, { text: "Starring", align: "left", lineHeight: 1.4, ...billing });
          f.add("name", "main", x, top + billH, 640 * f.unit, nameH, { ...name, align: "left" });
          f.add("handle", "main", x, top + billH + nameH, 640 * f.unit, handleH, { ...handle, align: "left" });
          const barsW = 420 * f.unit;
          f.add("visual", "main", a.right - barsW, y + rowH / 2 - 40 * f.unit, barsW, 56 * f.unit, { visual: "bars", color: SILVER });
          f.add("time", "main", a.right - barsW, y + rowH / 2 + 26 * f.unit, barsW, f.lines(20, 1, 1.4), { ...time, align: "right" });
        },
      },
    ]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "The late show", kicker),
    burst(a.cx, f.by({ square: 86, portrait: 120, story: 170, landscape: 0 }), f.by({ square: 6, portrait: 14, story: 30, landscape: 0 })),
    heading(f, c, title, 2, f.by({ square: 4, portrait: 10, story: 24, landscape: 0 })),
    space(),
    screen(c, 2, f.by({ square: 26, portrait: 36, story: 50, landscape: 0 })),
    space(),
    label(f, c, "billing", "Starring", billing),
    names(f, c, name, handle, 2),
    sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 40, portrait: 54, story: 72, landscape: 0 }), { color: SILVER }, f.by({ square: 16, portrait: 26, story: 40, landscape: 0 })),
    clock(f, c, time, 8),
  ]);
});

/** A prize lecture on parchment: the speaker crowned in a gold laurel wreath, navy ink, an engraved rule. */
const laureate = template("laureate", "Laureate", { color: "#f4eddd", to: "#e7dcc4", angle: 180 }, PAPER, (f) => {
  const a = area(f);
  const navy = "#14213d";
  const soft = "#5d6478";
  const deepGold = "#9a7b3c";
  frameBorder(f, f.pad * 0.4, { gap: 8, outer: 1.5, inner: 1, corner: "round", cut: 26 }, navy, 0.75);
  const kicker: Style = { font: CINZEL, size: 22, weight: 700, color: "#8a6a2f", uppercase: true, letterSpacing: 380 };
  const title: Style = { font: CORMORANT, size: f.by({ square: 56, portrait: 64, story: 66, landscape: 62 }), weight: 600, color: navy, lineHeight: 1.06, enter: "glide" };
  const name: Style = { font: CINZEL, size: 26, weight: 700, color: navy, letterSpacing: 100 };
  const handle: Style = { font: CORMORANT, size: 24, weight: 600, color: soft };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 48, portrait: 54, story: 64, landscape: 52 }), color: navy, highlight: navy, lineHeight: 1.45 };
  const frame: CameoStyle = { halo: laurelWreath(), scale: 1.6, haloColor: GOLD, rim: GOLD, rimWidth: 3, loop: "slowZoom" };
  const time: Style = { font: CINZEL, size: 20, weight: 600, color: soft, letterSpacing: 260 };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.42);
    const right = columnOf(f.width * 0.47, a.right - 60);
    stack(a.top, a.bottom, [cameo(f, left.x + left.w / 2, 270, frame), names(f, left, name, handle, 20)]);
    stack(a.top, a.bottom, [label(f, right, "kicker", "The laureate lecture", kicker), heading(f, right, title, 2, 14), ornament(f, right.x + right.w / 2, "rule", taperedRule(), 380, { color: deepGold }, 18), space(), captions(f, right, words, 4, 18), space(), sound(f, right.x + right.w / 2, 460, 56, { color: navy }, 18), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 40, a.right - 40);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "The laureate lecture", kicker),
    heading(f, c, title, 2, 14),
    cameo(f, a.cx, f.by({ square: 128, portrait: 196, story: 260, landscape: 0 }), frame, f.by({ square: 12, portrait: 24, story: 44, landscape: 0 })),
    names(f, c, name, handle, 8),
    ornament(f, a.cx, "rule", taperedRule(), f.by({ square: 300, portrait: 360, story: 420, landscape: 0 }), { color: deepGold }, 16),
    space(), captions(f, c, words, 3, f.by({ square: 10, portrait: 18, story: 32, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 300, portrait: 360, story: 420, landscape: 0 }), f.by({ square: 36, portrait: 48, story: 64, landscape: 0 }), { color: navy }, 12),
    clock(f, c, time, 10),
  ]);
});

/** A reading room in green morocco: gilt bands as on a book's spine, a chapter opening with its numeral in gold, the
 *  words set as the page, and the speaker named at its foot as on a bookplate. */
const library = template("the-library", "The Library", { color: "#203528", to: "#0e1b14", angle: 180 }, MINT, (f) => {
  const a = area(f);
  const cream = "#f1e7cf";
  const soft = "#a7c0ad";
  const band = (name: string, y: number) => f.add("graphic", name, 0, y, f.width, 64 * f.unit, { art: spineBand(f.width), color: GOLD, opacity: 0.95 });
  const numeral: Style = { font: CINZEL, size: f.by({ square: 76, portrait: 96, story: 110, landscape: 104 }), weight: 500, color: GOLD, lineHeight: 1.05, enter: "fade" };
  const kicker: Style = { font: TENOR, size: 22, color: GOLD, uppercase: true, letterSpacing: 400 };
  const title: Style = { font: CORMORANT, size: f.by({ square: 56, portrait: 64, story: 66, landscape: 60 }), weight: 700, color: cream, lineHeight: 1.06, enter: "glide" };
  const name: Style = { font: CORMORANT, size: 32, weight: 700, color: cream };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: BASKERVILLE, size: f.by({ square: 48, portrait: 54, story: 62, landscape: 52 }), color: cream, highlight: "#d9b45a", lineHeight: 1.45 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 4 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 200 };
  const topBand = f.tall ? f.height * 0.08 : f.pad * 0.55;
  const footBand = f.tall ? f.height * 0.87 : f.height - f.pad * 0.55 - 64 * f.unit;
  band("band-top", topBand);
  band("band-foot", footBand);
  const top = topBand + 64 * f.unit + f.by({ square: 30, portrait: 44, story: 60, landscape: 40 });
  const bottom = footBand - f.by({ square: 26, portrait: 40, story: 60, landscape: 34 });
  // The foot of the page: the bookplate on the left, the time on the right like a folio.
  const foot = (c: Column, d: number, gap = 0): Block => {
    const plate = byline(f, c.x, c.w * 0.6, d, name, handle, frame);
    const timeH = f.lines(20, 1, 1.4);
    return {
      h: plate.h,
      gap: gap * f.unit,
      draw: (y) => {
        plate.draw(y, plate.h);
        f.add("time", "main", c.x + c.w * 0.6, y + plate.h / 2 - timeH / 2, c.w * 0.4, timeH, { ...time, align: "right" });
      },
    };
  };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.4);
    const right = columnOf(f.width * 0.47, a.right - 40);
    stack(top, bottom, [label(f, left, "numeral", "XII", numeral), label(f, left, "kicker", "From the reading room", kicker, 10), heading(f, left, title, 2, 18), rule(f, left.x + left.w / 2, "rule", 90, GOLD, 2, 18)]);
    upright(f, "seam", f.width * 0.435, top, bottom, GOLD, 0.45);
    stack(top, bottom, [space(), captions(f, right, words, 4), space(), sound(f, right.x + right.w / 2, 460, 56, { color: GOLD }, 20), foot(right, 92, 26)]);
    return;
  }
  const c = columnOf(a.left + 20, a.right - 20);
  stack(top, bottom, [
    label(f, c, "numeral", "XII", numeral),
    label(f, c, "kicker", "From the reading room", kicker, 6),
    heading(f, c, title, 2, 14),
    rule(f, a.cx, "rule", 90, GOLD, 2, 8),
    space(), captions(f, c, words, 3), space(),
    sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 36, portrait: 48, story: 66, landscape: 0 }), { color: GOLD }),
    foot(c, f.by({ square: 76, portrait: 88, story: 104, landscape: 0 }), f.by({ square: 18, portrait: 28, story: 44, landscape: 0 })),
  ]);
});

/** A sapphire gala night: silver wings over a fine title, the speaker in a ring of beads, a scatter of light. */
const sapphireGala = template("sapphire-gala", "Sapphire Gala", { color: "#163b93", to: "#06143d", angle: 165 }, DUSK, (f) => {
  const a = area(f);
  const white = "#f4f6fb";
  const soft = "#a9b8de";
  const kicker: Style = { font: TENOR, size: 22, color: SILVER, uppercase: true, letterSpacing: 520 };
  const title: Style = { font: ITALIANA, size: f.by({ square: 52, portrait: 52, story: 52, landscape: 54 }), color: SILVER, uppercase: true, lineHeight: 1.1, letterSpacing: 80, enter: "glide", loop: "shimmer" };
  const name: Style = { font: ITALIANA, size: 30, color: white, uppercase: true, letterSpacing: 200 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 160 };
  const words: Style = { font: PLAYFAIR, size: f.by({ square: 56, portrait: 64, story: 74, landscape: 62 }), weight: 500, color: white, highlight: "#dbe4f5", lineHeight: 1.32 };
  const frame: CameoStyle = { rim: SILVER, rimWidth: 4, halo: beadRing(), scale: 1.32 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 200 };
  const glint = f.by({ square: 70, portrait: 84, story: 100, landscape: 90 });
  f.add("graphic", "sparkle-a", a.left, a.top + glint * 0.2, glint, glint, { art: sparkles(), color: SILVER, opacity: 0.8, loop: "pulse", speed: 0.5 });
  f.add("graphic", "sparkle-b", a.right - glint * 0.8, a.bottom - glint * 1.1, glint * 0.8, glint * 0.8, { art: sparkles(), color: SILVER, opacity: 0.7, flipX: true, loop: "pulse", speed: 0.4 });

  if (f.wide) {
    const left = columnOf(a.left + 80, f.width * 0.42);
    const right = columnOf(f.width * 0.47, a.right - 60);
    stack(a.top, a.bottom, [cameo(f, left.x + left.w / 2, 240, frame), names(f, left, name, handle, 30)]);
    stack(a.top, a.bottom, [ornament(f, right.x + right.w / 2, "wings", decoWings(), 380, { color: SILVER }), label(f, right, "kicker", "Gala evening", kicker, 20), heading(f, right, title, 2, 12), space(), captions(f, right, words, 3, 22), space(), sound(f, right.x + right.w / 2, 500, 60, { color: SILVER }, 18), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 30, a.right - 30);
  stack(a.top, a.bottom, [
    ornament(f, a.cx, "wings", decoWings(), f.by({ square: 300, portrait: 360, story: 440, landscape: 0 }), { color: SILVER, enter: "unfold" }),
    label(f, c, "kicker", "Gala evening", kicker, 18),
    heading(f, c, title, 2, 12),
    cameo(f, a.cx, f.by({ square: 100, portrait: 146, story: 210, landscape: 0 }), frame, f.by({ square: 20, portrait: 32, story: 50, landscape: 0 })),
    names(f, c, name, handle, 14),
    space(), captions(f, c, words, 3, f.by({ square: 10, portrait: 22, story: 38, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 42, portrait: 56, story: 76, landscape: 0 }), { color: SILVER }, 14),
    clock(f, c, time, 10),
  ]);
});

/** Peacock teal and gold: the speaker held in an oval cartouche like a locket, the words beneath. */
const cartoucheFrame = template("cartouche", "Cartouche", { color: "#0f444c", to: "#052127", angle: 180 }, MINT, (f) => {
  const a = area(f);
  const ivory = "#f3ead6";
  const soft = "#9cc7c4";
  const kicker: Style = { font: CINZEL, size: 22, weight: 600, color: GOLD, uppercase: true, letterSpacing: 420 };
  const title: Style = { font: CINZEL, size: f.by({ square: 42, portrait: 50, story: 50, landscape: 50 }), weight: 600, color: ivory, lineHeight: 1.14, letterSpacing: 30, enter: "glide" };
  const name: Style = { font: CINZEL, size: 26, weight: 600, color: ivory, letterSpacing: 80 };
  const handle: Style = { font: TENOR, size: 22, color: soft, letterSpacing: 140 };
  const words: Style = { font: CORMORANT, size: f.by({ square: 68, portrait: 78, story: 90, landscape: 76 }), weight: 700, color: ivory, highlight: "#e2c27a", lineHeight: 1.28 };
  const time: Style = { font: TENOR, size: 20, color: soft, letterSpacing: 160 };
  // The oval's inner ring runs 240 by 340 of its 300 by 400, so the round photo sits in it with sky above and below.
  const locket = (cx: number, w: number, gap = 0): Block => {
    const art = cartouche();
    const width = w * f.unit;
    const h = (width * art.h) / art.w;
    return {
      h,
      gap: gap * f.unit,
      draw: (y) => {
        f.add("graphic", "cartouche", cx - width / 2, y, width, h, { art, color: GOLD, enter: "iris" });
        const d = w * 0.66;
        const rim = 4 * f.unit;
        f.add("shape", "rim", cx - (d * f.unit) / 2 - rim, y + h / 2 - (d * f.unit) / 2 - rim, d * f.unit + rim * 2, d * f.unit + rim * 2, { shape: "ellipse", fill: GOLD });
        f.add("avatar", "main", cx - (d * f.unit) / 2, y + h / 2 - (d * f.unit) / 2, d * f.unit, d * f.unit);
      },
    };
  };

  if (f.wide) {
    const left = columnOf(a.left + 40, f.width * 0.4);
    const right = columnOf(f.width * 0.45, a.right - 60);
    stack(a.top, a.bottom, [locket(left.x + left.w / 2, 330), names(f, left, name, handle, 24)]);
    upright(f, "seam", f.width * 0.425, a.top + 40, a.bottom - 40, GOLD, 0.5);
    stack(a.top, a.bottom, [label(f, right, "kicker", "Episode XII", kicker), heading(f, right, title, 2, 16), ornament(f, right.x + right.w / 2, "scroll", scrollDivider(), 380, { color: GOLD }, 16), space(), captions(f, right, words, 3, 16), space(), sound(f, right.x + right.w / 2, 500, 60, { color: GOLD }, 16), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 20, a.right - 20);
  stack(a.top, a.bottom, [
    label(f, c, "kicker", "Episode XII", kicker),
    heading(f, c, title, 2, 12),
    locket(a.cx, f.by({ square: 176, portrait: 250, story: 330, landscape: 0 }), f.by({ square: 18, portrait: 30, story: 50, landscape: 0 })),
    names(f, c, name, handle, 14),
    space(), captions(f, c, words, 3, f.by({ square: 8, portrait: 20, story: 36, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 340, portrait: 400, story: 460, landscape: 0 }), f.by({ square: 42, portrait: 56, story: 76, landscape: 0 }), { color: GOLD }, 14),
    clock(f, c, time, 10),
  ]);
});

/** A gilded salon in white and gold: scrolled corners, a decorative title in warm umber, a scroll beneath it. */
const baroque = template("baroque", "Baroque", { color: "#f9f5ec", to: "#ece2cf", angle: 180 }, PAPER, (f) => {
  const a = area(f);
  const umber = "#3b2a1a";
  const soft = "#7d6a55";
  const deepGold = "#8a6a2f";
  const edge = f.pad * 0.3;
  corners(f, flourishCorner(), edge, edge, f.width - edge * 2, f.height - edge * 2, f.by({ square: 200, portrait: 220, story: 250, landscape: 220 }), { color: GOLD });
  const kicker: Style = { font: CINZEL, size: 22, weight: 700, color: "#8a6a2f", uppercase: true, letterSpacing: 420 };
  const title: Style = { font: CINZEL_DECO, size: f.by({ square: 44, portrait: 52, story: 52, landscape: 52 }), weight: 700, color: umber, lineHeight: 1.16, enter: "glide" };
  const name: Style = { font: CINZEL, size: 26, weight: 700, color: umber, letterSpacing: 80 };
  const handle: Style = { font: CORMORANT, size: 24, weight: 600, color: soft };
  const words: Style = { font: CORMORANT, size: f.by({ square: 68, portrait: 78, story: 90, landscape: 76 }), weight: 700, color: umber, highlight: deepGold, lineHeight: 1.28 };
  const frame: CameoStyle = { rim: GOLD, rimWidth: 5, halo: rings([196, 2], [184, 1]), scale: 1.28, loop: "slowZoom" };
  const time: Style = { font: CINZEL, size: 20, weight: 700, color: soft, letterSpacing: 260 };

  if (f.wide) {
    const left = columnOf(a.left + 80, f.width * 0.42);
    const right = columnOf(f.width * 0.47, a.right - 100);
    stack(a.top + 20, a.bottom - 20, [cameo(f, left.x + left.w / 2, 250, frame), names(f, left, name, handle, 26)]);
    stack(a.top + 20, a.bottom - 20, [label(f, right, "kicker", "Episode XII", kicker), heading(f, right, title, 2, 14), ornament(f, right.x + right.w / 2, "scroll", scrollDivider(), 420, { color: GOLD }, 14), space(), captions(f, right, words, 3, 16), space(), sound(f, right.x + right.w / 2, 480, 56, { color: deepGold }, 16), clock(f, right, time, 10)]);
    return;
  }
  const c = columnOf(a.left + 40, a.right - 40);
  stack(a.top + f.by({ square: 30, portrait: 40, story: 0, landscape: 0 }), a.bottom - f.by({ square: 20, portrait: 30, story: 0, landscape: 0 }), [
    label(f, c, "kicker", "Episode XII", kicker),
    heading(f, c, title, 2, 12),
    ornament(f, a.cx, "scroll", scrollDivider(), f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), { color: GOLD }, 12),
    cameo(f, a.cx, f.by({ square: 96, portrait: 140, story: 200, landscape: 0 }), frame, f.by({ square: 18, portrait: 30, story: 48, landscape: 0 })),
    names(f, c, name, handle, 14),
    space(), captions(f, c, words, 3, f.by({ square: 6, portrait: 18, story: 34, landscape: 0 })), space(),
    sound(f, a.cx, f.by({ square: 320, portrait: 380, story: 440, landscape: 0 }), f.by({ square: 38, portrait: 52, story: 70, landscape: 0 }), { color: deepGold }, 12),
    clock(f, c, time, 8),
  ]);
});

/** Nothing to prove: stone and espresso, a fine serif, wide-set capitals and a single hairline. */
const quietLuxury = template("quiet-luxury", "Quiet Luxury", { color: "#e6e0d6" }, PAPER, (f) => {
  const a = area(f, 1.15);
  const espresso = "#2b2520";
  const taupe = "#7b7064";
  const small: Style = { font: TENOR, size: 20, color: taupe, uppercase: true, letterSpacing: 420 };
  const title: Style = { font: CORMORANT, size: f.by({ square: 72, portrait: 80, story: 80, landscape: 76 }), weight: 500, color: espresso, lineHeight: 1.04, align: "left", enter: "glide" };
  const name: Style = { font: TENOR, size: 18, color: espresso, uppercase: true, letterSpacing: 320, align: "left" };
  const handle: Style = { font: CORMORANT, size: 24, weight: 500, color: taupe, align: "left" };
  const words: Style = { font: CORMORANT, size: f.by({ square: 66, portrait: 76, story: 88, landscape: 74 }), weight: 600, color: espresso, highlight: espresso, lineHeight: 1.26, align: "left" };
  const time: Style = { font: TENOR, size: 20, color: taupe, letterSpacing: 300 };
  const c = columnOf(a.left, a.right);
  // A plain photo, no rim: nothing here needs to announce itself.
  const signature = (col: Column, d: number, gap = 0) => byline(f, col.x, col.w * 0.7, d, name, handle, {}, gap);

  if (f.wide) {
    const left = columnOf(a.left, f.width * 0.47);
    const right = columnOf(f.width * 0.53, a.right);
    stack(a.top, a.bottom, [pair(f, columnOf(a.left, a.right), ["series", "number"], ["In conversation", "No. 12"], small), space(), heading(f, left, title, 3), space(), signature(left, 76)]);
    stack(a.top + 90, a.bottom, [space(), captions(f, right, words, 4, 0, 0), space(), rule(f, right.x + right.w / 2, "rule", right.w / f.unit, taupe, 1, 10), {
      h: 48 * f.unit,
      gap: 18 * f.unit,
      draw: (y, h) => {
        f.add("visual", "main", right.x, y, 260 * f.unit, h, { visual: "bars", color: taupe });
        f.add("time", "main", right.x + right.w - 260 * f.unit, y, 260 * f.unit, h, { ...time, align: "right" });
      },
    }]);
    return;
  }
  stack(a.top, a.bottom, [
    pair(f, c, ["series", "number"], ["In conversation", "No. 12"], small),
    space(f.by({ square: 0.4, portrait: 0.6, story: 0.8, landscape: 0 })),
    heading(f, c, title, 2),
    rule(f, a.left + 60 * f.unit, "rule", 120, taupe, 1, 26),
    space(0.5),
    captions(f, c, words, 3, 0, 0),
    space(1),
    {
      h: 44 * f.unit,
      gap: 0,
      draw: (y, h) => {
        f.add("visual", "main", a.left, y, 240 * f.unit, h, { visual: "bars", color: taupe });
        f.add("time", "main", a.right - 260 * f.unit, y, 260 * f.unit, h, { ...time, align: "right" });
      },
    },
    rule(f, a.cx, "rule-foot", a.w / f.unit, taupe, 1, 22),
    signature(c, f.by({ square: 68, portrait: 76, story: 88, landscape: 0 }), 22),
  ]);
});

/** The podcast templates in the order the picker shows them. */
export const PODCAST_TEMPLATES: TemplateChoice[] = [
  royalCrest,
  gildedFrame,
  emeraldSalon,
  bordeaux,
  gatsbyDeco,
  ivoryLetterpress,
  marbleGold,
  midnightOpera,
  heritageBroadcast,
  monogram,
  gazette,
  imperialPurple,
  champagneToast,
  noirCinema,
  laureate,
  library,
  sapphireGala,
  cartoucheFrame,
  baroque,
  quietLuxury,
];
