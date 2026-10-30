/* The kit every podcast template is built with: a frame shape laid out in its own pixels, stacks of blocks down a
   column, frosted glass, the speaker's photo, title, captions, clocks, sound and stats, and the fonts Soundbite
   ships. A template is only layers, so once it is picked every part of it can be moved, restyled or deleted. */
import { FRAME_SIZES, type Adjust, type Art, type Clock, type Crop, type Layer, type LayerKind, type Layout, type Page, type Template } from "@drkxbt/audiogram";
import { GLYPHS, type GlyphName } from "./glyphs.js";

/** A design the user can start a clip from, laid out for whichever frame shape they picked. */
export interface TemplateChoice {
  id: string;
  name: string;
  make(layout: Layout): Template;
}

export type Style = Partial<Omit<Layer, "id" | "kind" | "x" | "y" | "w" | "h">>;

// Places in THEMES. A template sets every colour it uses, but a layer the user adds later takes the theme's, so each
// template names the theme whose words read on its page.
export const INK = 0;
export const PAPER = 1;

export const INTER = "Inter Variable";
export const DM_SANS = "DM Sans Variable";
export const OUTFIT = "Outfit Variable";
export const GROTESK = "Space Grotesk Variable";
export const BRICOLAGE = "Bricolage Grotesque Variable";
export const ARCHIVO = "Archivo Variable";
export const SERIF = "Instrument Serif";
// Dot-matrix figures for the clocks. Handjet rather than Doto: Doto's colon is two crosses of dots and its % an X,
// so a clock read "0‡16" and a count "27X". Its dots only read from about 48px up.
export const DOTS = "Handjet Variable";

export const WHITE = "#ffffff";

/** A frame shape being laid out in its own pixels; the layers keep their boxes as fractions of it, as the editor does. */
export interface Frame {
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
  /** Design pixels in this frame's pixels. */
  px(length: number): number;
}

export function template(id: string, name: string, page: Page, theme: number, draw: (frame: Frame) => void): TemplateChoice {
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
          // A label's box hugs its words, so it can be picked and moved by what shows of it.
          const fit = kind === "text" ? { autoWidth: true } : {};
          layers.push({ id: `${kind}-${name}`, kind, x: x / width, y: y / height, w: w / width, h: h / height, rotation: 0, opacity: 1, ...fit, ...style });
        },
        lines: (size, count = 1, spacing = 1.15) => size * unit * spacing * count,
        px: (length) => length * unit,
      });
      return { layers, page: { ...page }, theme };
    },
  };
}

/** The part of the frame words keep to: the margin all round, and on a story the bands the apps cover at top and foot. */
export function area(f: Frame) {
  const left = f.pad;
  const top = f.tall ? f.height * 0.1 : f.pad;
  const bottom = f.tall ? f.height * 0.85 : f.height - f.pad;
  return { left, right: f.width - left, top, bottom, cx: f.width / 2, w: f.width - left * 2, h: bottom - top };
}

/** A run across the frame for a stack of blocks: its left edge and its width, in frame pixels. */
export interface Column {
  x: number;
  w: number;
}

export const column = (left: number, right: number): Column => ({ x: left, w: right - left });

/** Part of a stack: its height, the space before it, and how it lays itself down once it knows where it starts. A
 *  flexible block takes a share of the height the others leave, by its weight. */
export interface Block {
  h: number;
  gap: number;
  flex?: number;
  draw(y: number, h: number): void;
}

export type Blocks = Array<Block | false>;

export const present = (blocks: Blocks) => blocks.filter((block): block is Block => Boolean(block));

/** How tall a stack of blocks stands with no room to spare. */
export const measure = (blocks: Blocks) => present(blocks).reduce((sum, block) => sum + block.h + block.gap, 0);

/** Blocks laid down a column from `top` to `bottom`; the height left over goes to the flexible ones, or above and
 *  below the whole stack when none is, so it sits in the middle. */
export function stack(top: number, bottom: number, blocks: Blocks): void {
  const list = present(blocks);
  const spare = Math.max(0, bottom - top - measure(list));
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
export const space = (flex = 1): Block => ({ h: 0, gap: 0, flex, draw: () => {} });

/** A block of a fixed height, drawn by `draw` once its place is known. */
export const row = (f: Frame, h: number, gap: number, draw: (y: number, h: number) => void): Block => ({ h: f.px(h), gap: f.px(gap), draw });

/** The page's photo from the bundled library, toned, covering the frame under everything else. */
export interface PhotoLook {
  filter?: string;
  adjust?: Adjust;
  crop?: Crop;
  loop?: Style["loop"];
}

export function backdrop(f: Frame, id: string, look: PhotoLook = {}): void {
  f.add("image", "photo", 0, 0, f.width, f.height, { image: `photo:${id}`, backdrop: true, mask: "rect", ...look });
}

/** A library photo in a panel of its own, cut to its box. */
export function panel(f: Frame, id: string, x: number, y: number, w: number, h: number, look: PhotoLook & { corner?: number } = {}): void {
  const { corner = 0, ...tone } = look;
  f.add("image", "photo", x, y, w, h, { image: `photo:${id}`, mask: "rect", radius: round(f.px(corner) / Math.min(w, h)), ...tone });
}

export const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Frosted glass: what lies under it shows through blurred by `frost`, tinted by `tint` as strongly as `strength`, with
 * a hairline round its edge where it catches the light and a soft shadow under it. Corners are in design pixels, so
 * they stay the same size whatever the card's.
 */
export interface Glass {
  tint: string;
  strength: number;
  frost: number;
  corner: number;
  edge?: number;
  shadow?: boolean;
}

export function glass(f: Frame, name: string, x: number, y: number, w: number, h: number, look: Glass, style: Style = {}): void {
  f.add("shape", name, x, y, w, h, {
    shape: "rect",
    radius: Math.min(0.5, round(f.px(look.corner) / Math.min(w, h))),
    fill: look.tint,
    opacity: look.strength,
    frost: look.frost,
    shadow: look.shadow ?? true,
    stroke: WHITE,
    strokeWidth: look.edge ?? 1.5,
    ...style,
  });
}

/** A glass card `w` wide at `x`, as tall as its blocks and `inset` design pixels round them, its top at `y`. */
export function card(f: Frame, name: string, x: number, y: number, w: number, inset: number, look: Glass, blocks: Blocks, style: Style = {}): number {
  const h = measure(blocks) + f.px(inset) * 2;
  glass(f, name, x, y, w, h, look, style);
  stack(y + f.px(inset), y + h - f.px(inset), blocks);
  return h;
}

/** How the speaker's photo looks without one: their initial in `ink` on `fill`; `rim` rings it with a hairline. */
export interface Portrait {
  fill: string;
  ink: string;
  rim?: string;
}

export function avatarAt(f: Frame, cx: number, cy: number, d: number, look: Portrait, style: Style = {}): void {
  const side = f.px(d);
  if (look.rim) {
    const r = side / 2 + f.px(5);
    f.add("shape", "rim", cx - r, cy - r, r * 2, r * 2, { shape: "ellipse", fill: look.rim, opacity: 0.45, ...style });
  }
  f.add("avatar", "main", cx - side / 2, cy - side / 2, side, side, { fill: look.fill, color: look.ink, ...style });
}

/** The clip's title, room for `count` lines of it. */
export function heading(f: Frame, c: Column, style: Style, count = 2, gap = 0): Block {
  const spacing = style.lineHeight ?? 1.15;
  const h = f.lines(style.size ?? 50, count, spacing) + f.px(2);
  return { h, gap: f.px(gap), draw: (y) => f.add("title", "main", c.x, y, c.w, h, { align: "left", ...style, lineHeight: spacing }) };
}

/** The captions, room for `count` lines; a flexible one also takes a share of the spare height. */
export function captions(f: Frame, c: Column, style: Style, count = 3, gap = 0, flex = 0): Block {
  // A hair over the lines asked for, so the painter's count of the lines that fit never rounds one away.
  const h = f.lines(style.size ?? 56, count + 0.1, style.lineHeight ?? 1.3);
  return { h, gap: f.px(gap), flex, draw: (y, height) => f.add("captions", "main", c.x, y, c.w, height, { align: "left", lineHeight: 1.3, ...style }) };
}

/** A hairline across the column. */
export function rule(f: Frame, c: Column, name: string, color: string, opacity: number, gap = 0): Block {
  return row(f, 8, gap, (y, h) => f.add("shape", name, c.x, y, c.w, h, { shape: "line", fill: color, strokeWidth: 1.5, opacity }));
}

/** The speaker's photo at the left of a row, their name over their handle beside it. */
export function byline(f: Frame, c: Column, d: number, portrait: Portrait, name: Style, handle: Style | null, gap = 0, extra?: (y: number, h: number) => void): Block {
  const nameH = f.lines(name.size ?? 30, 1, 1.3);
  const handleH = handle ? f.lines(handle.size ?? 24, 1, 1.3) : 0;
  const h = Math.max(f.px(d), nameH + handleH);
  return {
    h,
    gap: f.px(gap),
    draw: (y) => {
      avatarAt(f, c.x + f.px(d) / 2, y + h / 2, d, portrait);
      const x = c.x + f.px(d) + f.px(22);
      const top = y + (h - nameH - handleH) / 2;
      f.add("name", "main", x, top, c.x + c.w - x, nameH, { align: "left", ...name });
      if (handle) f.add("handle", "main", x, top + nameH, c.x + c.w - x, handleH, { align: "left", ...handle });
      extra?.(y, h);
    },
  };
}

/** How tall the room for two lines of a title is: a hair over, so the painter's count of the lines that fit never
 *  rounds one away. */
export const titleRoom = (f: Frame, size: number, spacing: number) => f.lines(size, 2, spacing) + f.px(2);

/** The speaker's name over room for two lines of the title, the speaker's photo at the top right: a card's top line.
 *  The name goes first so a title of one line leaves its spare room below the block, not between the two. */
export function header(f: Frame, c: Column, title: Style, name: Style, d: number, portrait: Portrait, gap = 0): Block {
  const nameH = f.lines(name.size ?? 26, 1, 1.3);
  const titleH = titleRoom(f, title.size ?? 32, 1.2);
  const h = Math.max(f.px(d), nameH + titleH + f.px(4));
  return {
    h,
    gap: f.px(gap),
    draw: (y) => {
      const w = c.w - f.px(d) - f.px(24);
      f.add("name", "main", c.x, y, w, nameH, { align: "left", ...name });
      f.add("title", "main", c.x, y + nameH + f.px(4), w, titleH, { align: "left", ...title, lineHeight: 1.2 });
      avatarAt(f, c.x + c.w - f.px(d) / 2, y + f.px(d) / 2, d, portrait);
    },
  };
}

/** The sound as a ring of dots `d` across centred on `cx`, with whatever `inside` puts in its middle. */
export function ring(f: Frame, cx: number, d: number, color: string, inside: ((cy: number) => void) | null, gap = 0): Block {
  return row(f, d, gap, (y, h) => {
    f.add("visual", "main", cx - h / 2, y, h, h, { visual: "ring", color });
    inside?.(y + h / 2);
  });
}

/** A clock on one line centred on a point, `w` design pixels wide. */
export function clockAt(f: Frame, name: string, cx: number, cy: number, w: number, style: Style): void {
  const h = f.lines(style.size ?? 40, 1, 1.2);
  f.add("time", name, cx - f.px(w) / 2, cy - h / 2, f.px(w), h, { align: "center", ...style });
}

/** The sound as bars, `w` frame pixels wide from `x`. */
export function bars(f: Frame, x: number, w: number, h: number, color: string, gap = 0, style: Style = {}): Block {
  return row(f, h, gap, (y, height) => f.add("visual", "main", x, y, w, height, { visual: "bars", color, ...style }));
}

/** A drawn icon from the bundled set, `size` design pixels square, in the layer's colour. */
export function icon(f: Frame, name: string, glyph: GlyphName, x: number, y: number, size: number, color: string, opacity = 1, style: Style = {}): void {
  f.add("graphic", name, x, y, f.px(size), f.px(size), { art: GLYPHS[glyph], color, opacity, ...style });
}

/** One of a row of stats: a figure, or one of the clip's clocks, over a small icon and what the figure counts. */
export type Stat = ({ text: string } | { clock: Exclude<Clock, "both"> }) & { glyph: GlyphName; label: string };

export interface StatLook {
  value: Style;
  label: Style;
  /** The icons' colour and how strongly they show; the labels take the same. */
  ink: string;
  dim: number;
}

/** Stats side by side across the column, each a figure over an icon and its label, as a status card shows them. */
export function stats(f: Frame, c: Column, items: Stat[], look: StatLook, gap = 0): Block {
  const valueH = f.lines(look.value.size ?? 40, 1, 1.2);
  const labelSize = look.label.size ?? 26;
  const labelH = f.lines(labelSize, 1, 1.25);
  const glyph = labelSize * 1.05;
  const under = Math.max(f.px(glyph), labelH);
  const between = f.px(12);
  return {
    h: valueH + between + under,
    gap: f.px(gap),
    draw: (y) => {
      const step = c.w / items.length;
      items.forEach((item, index) => {
        const name = `stat-${index + 1}`;
        const x = c.x + step * index;
        const w = step - f.px(16);
        if ("clock" in item) f.add("time", name, x, y, w, valueH, { align: "left", clock: item.clock, ...look.value });
        // Words are drawn from the top of their box and clocks about its middle, so the words get a box one line tall
        // centred where the clocks' middle is, which sets them level.
        else {
          const lineH = f.lines(look.value.size ?? 40, 1, 1);
          f.add("text", name, x, y + (valueH - lineH) / 2, w, lineH, { text: item.text, align: "left", ...look.value, lineHeight: 1 });
        }
        const top = y + valueH + between;
        icon(f, name, item.glyph, x, top + (under - f.px(glyph)) / 2, glyph, look.ink, look.dim);
        f.add("text", `${name}-label`, x + f.px(glyph + 10), top + (under - labelH) / 2, w - f.px(glyph + 10), labelH, { text: item.label, align: "left", lineHeight: 1.25, color: look.ink, opacity: look.dim, ...look.label });
      });
    },
  };
}

// The figures a show's card carries: the episode, as sample copy plain enough that nobody exports it as a fact, and
// the clip's own time played and left, which are always true.
export const SHOW: Stat[] = [
  { text: "Ep. 00", glyph: "microphone", label: "Episode" },
  { clock: "elapsed", glyph: "headphones", label: "Played" },
  { clock: "remaining", glyph: "clock", label: "Left" },
];

// How faint a secondary line of words goes, a handle or a label: a 1080 frame shows at about a third of its size in a
// phone's feed, so words that carry something are never fainter than this nor smaller than 26.
export const QUIET = 0.78;

export const ANTON = "Anton";
export const ARCHIVO_BLACK = "Archivo Black";
export const SYNE = "Syne Variable";
export const MONO = "Space Mono";
export const PACIFICO = "Pacifico";
export const FREDOKA = "Fredoka Variable";
export const LUCKIEST = "Luckiest Guy";
export const RIGHTEOUS = "Righteous";
export const RALEWAY = "Raleway Variable";
export const CAVEAT = "Caveat Variable";

// The warm dark theme: on a deep red page its muted words still read, where Ink's grey would not.
export const EMBER = 4;

/**
 * Plain words on one line, their top at `y` and `x` the edge or middle they are set from. The box's width is a guess
 * from `advance`, how wide a letter of the face runs as a share of its size; right and centred words are drawn from the
 * box's right edge or middle, so a wrong guess never moves them, and the editor fits the box once it is touched.
 */
export function label(f: Frame, name: string, text: string, x: number, y: number, style: Style, advance = 0.62): number {
  const size = style.size ?? 40;
  const w = f.px(size * text.length * (advance + (style.letterSpacing ?? 0) / 1000));
  const h = f.lines(size, 1, 1);
  const align = style.align ?? "left";
  f.add("text", name, align === "right" ? x - w : align === "center" ? x - w / 2 : x, y, w, h, { text, ...style, align, lineHeight: 1 });
  return h;
}

/** A length in a drawing, to a tenth: fine enough for a 1080 frame and short enough for a saved kit to keep. */
export const tenth = (value: number) => Math.round(value * 10) / 10;

/** Rows of small waves across a `w` by `h` box, the squiggles a screen print is patterned with. */
export function squiggles(w: number, h: number, rows: number, waves: number, width: number): Art {
  const step = h / rows;
  const half = (w - width * 2) / waves / 2;
  const rise = Math.min(step * 0.32, half * 0.7);
  let d = "";
  for (let r = 0; r < rows; r++) d += `M${tenth(width)} ${tenth(step * (r + 0.5))}q${tenth(half / 2)} ${tenth(-rise)} ${tenth(half)} 0${`t${tenth(half)} 0`.repeat(waves * 2 - 1)}`;
  return { w: tenth(w), h: tenth(h), paths: [{ d, stroke: "currentColor", width }] };
}

/** A grid of dots `gap` apart across a `w` by `h` box, like a halftone. */
export function dots(w: number, h: number, gap: number, r: number): Art {
  let d = "";
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) d += `M${tenth(x - r)} ${tenth(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  return { w: tenth(w), h: tenth(h), paths: [{ d, fill: "currentColor" }] };
}

/** Squares stepping in from the edges of a `w` by `h` frame, up to two deep along the top and foot and one at the
 *  sides, with a fainter one at some tips, as a pixel dissolve leaves them. The same frame always gets the same steps. */
export function pixels(w: number, h: number, cell: number): Art {
  const across = Math.round(w / cell);
  const down = Math.round(h / cell);
  const cw = w / across;
  const ch = h / down;
  const depth = (i: number, seed: number, most: number) => Math.max(0, Math.min(most, Math.round(0.9 + Math.sin(i * 1.3 + seed) * 0.8 + Math.sin(i * 0.37 + seed * 3) * 0.7)));
  const square = (x: number, y: number) => `M${tenth(x)} ${tenth(y)}h${tenth(cw)}v${tenth(ch)}h${tenth(-cw)}z`;
  let solid = "";
  let faint = "";
  for (let i = 0; i < across; i++) {
    for (const [seed, from] of [[1, (j: number) => j * ch], [2, (j: number) => h - (j + 1) * ch]] as const) {
      const k = depth(i, seed, 2);
      for (let j = 0; j < k; j++) solid += square(i * cw, from(j));
      if (k < 2 && (i * 7 + seed) % 3 === 0) faint += square(i * cw, from(k));
    }
  }
  for (let i = 2; i < down - 2; i++) {
    if (depth(i, 3, 1)) solid += square(0, i * ch);
    if (depth(i, 4, 1)) solid += square(w - cw, i * ch);
  }
  return { w: tenth(w), h: tenth(h), paths: [{ d: solid, fill: "currentColor" }, { d: faint, fill: "currentColor", opacity: 0.5 }] };
}

/** The speaker's photo over a frame-wide row: their name and handle beside it, and the sound at the row's far end. */
export function signoff(f: Frame, c: Column, d: number, portrait: Portrait, name: Style, handle: Style, color: string, gap = 0): Block {
  return byline(f, c, d, portrait, name, handle, gap, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(220), y + (h - f.px(44)) / 2, f.px(220), f.px(44), { visual: "bars", color });
  });
}
