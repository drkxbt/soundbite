/* Sixteen ready-made looks for podcast and live audio clips, in a quiet modern manner: a single-tone photo carrying the
   mood, frosted glass floating over it, thin labels, a ring of dots or a dot-matrix clock for the time, a row of small
   stats. Each is laid out for every frame shape the editor offers. A template is only layers, so once it is picked
   every part of it can be moved, restyled or deleted, and the words on its labels are sample copy for the user to
   change. Free of the DOM, so it can be tested on its own. */
import { FRAME_SIZES, type Adjust, type Clock, type Crop, type Layer, type LayerKind, type Layout, type Page, type Template } from "@drkxbt/audiogram";
import { GLYPHS, type GlyphName } from "./glyphs.js";

/** A design the user can start a clip from, laid out for whichever frame shape they picked. */
export interface TemplateChoice {
  id: string;
  name: string;
  make(layout: Layout): Template;
}

type Style = Partial<Omit<Layer, "id" | "kind" | "x" | "y" | "w" | "h">>;

// Places in THEMES. A template sets every colour it uses, but a layer the user adds later takes the theme's, so each
// template names the theme whose words read on its page.
const INK = 0;
const PAPER = 1;

const INTER = "Inter Variable";
const DM_SANS = "DM Sans Variable";
const OUTFIT = "Outfit Variable";
const GROTESK = "Space Grotesk Variable";
const BRICOLAGE = "Bricolage Grotesque Variable";
const ARCHIVO = "Archivo Variable";
const SERIF = "Instrument Serif";
// Dot-matrix figures for the clocks. Handjet rather than Doto: Doto's colon is two crosses of dots and its % an X,
// so a clock read "0‡16" and a count "27X". Its dots only read from about 48px up.
const DOTS = "Handjet Variable";

const WHITE = "#ffffff";

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
  /** Design pixels in this frame's pixels. */
  px(length: number): number;
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
function area(f: Frame) {
  const left = f.pad;
  const top = f.tall ? f.height * 0.1 : f.pad;
  const bottom = f.tall ? f.height * 0.85 : f.height - f.pad;
  return { left, right: f.width - left, top, bottom, cx: f.width / 2, w: f.width - left * 2, h: bottom - top };
}

/** A run across the frame for a stack of blocks: its left edge and its width, in frame pixels. */
interface Column {
  x: number;
  w: number;
}

const column = (left: number, right: number): Column => ({ x: left, w: right - left });

/** Part of a stack: its height, the space before it, and how it lays itself down once it knows where it starts. A
 *  flexible block takes a share of the height the others leave, by its weight. */
interface Block {
  h: number;
  gap: number;
  flex?: number;
  draw(y: number, h: number): void;
}

type Blocks = Array<Block | false>;

const present = (blocks: Blocks) => blocks.filter((block): block is Block => Boolean(block));

/** How tall a stack of blocks stands with no room to spare. */
const measure = (blocks: Blocks) => present(blocks).reduce((sum, block) => sum + block.h + block.gap, 0);

/** Blocks laid down a column from `top` to `bottom`; the height left over goes to the flexible ones, or above and
 *  below the whole stack when none is, so it sits in the middle. */
function stack(top: number, bottom: number, blocks: Blocks): void {
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
const space = (flex = 1): Block => ({ h: 0, gap: 0, flex, draw: () => {} });

/** A block of a fixed height, drawn by `draw` once its place is known. */
const row = (f: Frame, h: number, gap: number, draw: (y: number, h: number) => void): Block => ({ h: f.px(h), gap: f.px(gap), draw });

/** The page's photo from the bundled library, toned, covering the frame under everything else. */
interface PhotoLook {
  filter?: string;
  adjust?: Adjust;
  crop?: Crop;
  loop?: Style["loop"];
}

function backdrop(f: Frame, id: string, look: PhotoLook = {}): void {
  f.add("image", "photo", 0, 0, f.width, f.height, { image: `photo:${id}`, backdrop: true, mask: "rect", ...look });
}

/** A library photo in a panel of its own, cut to its box. */
function panel(f: Frame, id: string, x: number, y: number, w: number, h: number, look: PhotoLook & { corner?: number } = {}): void {
  const { corner = 0, ...tone } = look;
  f.add("image", "photo", x, y, w, h, { image: `photo:${id}`, mask: "rect", radius: round(f.px(corner) / Math.min(w, h)), ...tone });
}

const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Frosted glass: what lies under it shows through blurred by `frost`, tinted by `tint` as strongly as `strength`, with
 * a hairline round its edge where it catches the light and a soft shadow under it. Corners are in design pixels, so
 * they stay the same size whatever the card's.
 */
interface Glass {
  tint: string;
  strength: number;
  frost: number;
  corner: number;
  edge?: number;
  shadow?: boolean;
}

function glass(f: Frame, name: string, x: number, y: number, w: number, h: number, look: Glass, style: Style = {}): void {
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
function card(f: Frame, name: string, x: number, y: number, w: number, inset: number, look: Glass, blocks: Blocks, style: Style = {}): number {
  const h = measure(blocks) + f.px(inset) * 2;
  glass(f, name, x, y, w, h, look, style);
  stack(y + f.px(inset), y + h - f.px(inset), blocks);
  return h;
}

/** How the speaker's photo looks without one: their initial in `ink` on `fill`; `rim` rings it with a hairline. */
interface Portrait {
  fill: string;
  ink: string;
  rim?: string;
}

function avatarAt(f: Frame, cx: number, cy: number, d: number, look: Portrait, style: Style = {}): void {
  const side = f.px(d);
  if (look.rim) {
    const r = side / 2 + f.px(5);
    f.add("shape", "rim", cx - r, cy - r, r * 2, r * 2, { shape: "ellipse", fill: look.rim, opacity: 0.45, ...style });
  }
  f.add("avatar", "main", cx - side / 2, cy - side / 2, side, side, { fill: look.fill, color: look.ink, ...style });
}

/** The clip's title, room for `count` lines of it. */
function heading(f: Frame, c: Column, style: Style, count = 2, gap = 0): Block {
  const spacing = style.lineHeight ?? 1.15;
  const h = f.lines(style.size ?? 50, count, spacing) + f.px(2);
  return { h, gap: f.px(gap), draw: (y) => f.add("title", "main", c.x, y, c.w, h, { align: "left", ...style, lineHeight: spacing }) };
}

/** The captions, room for `count` lines; a flexible one also takes a share of the spare height. */
function captions(f: Frame, c: Column, style: Style, count = 3, gap = 0, flex = 0): Block {
  // A hair over the lines asked for, so the painter's count of the lines that fit never rounds one away.
  const h = f.lines(style.size ?? 56, count + 0.1, style.lineHeight ?? 1.3);
  return { h, gap: f.px(gap), flex, draw: (y, height) => f.add("captions", "main", c.x, y, c.w, height, { align: "left", lineHeight: 1.3, ...style }) };
}

/** A hairline across the column. */
function rule(f: Frame, c: Column, name: string, color: string, opacity: number, gap = 0): Block {
  return row(f, 8, gap, (y, h) => f.add("shape", name, c.x, y, c.w, h, { shape: "line", fill: color, strokeWidth: 1.5, opacity }));
}

/** The speaker's photo at the left of a row, their name over their handle beside it. */
function byline(f: Frame, c: Column, d: number, portrait: Portrait, name: Style, handle: Style | null, gap = 0, extra?: (y: number, h: number) => void): Block {
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
const titleRoom = (f: Frame, size: number, spacing: number) => f.lines(size, 2, spacing) + f.px(2);

/** The speaker's name over room for two lines of the title, the speaker's photo at the top right: a card's top line.
 *  The name goes first so a title of one line leaves its spare room below the block, not between the two. */
function header(f: Frame, c: Column, title: Style, name: Style, d: number, portrait: Portrait, gap = 0): Block {
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
function ring(f: Frame, cx: number, d: number, color: string, inside: ((cy: number) => void) | null, gap = 0): Block {
  return row(f, d, gap, (y, h) => {
    f.add("visual", "main", cx - h / 2, y, h, h, { visual: "ring", color });
    inside?.(y + h / 2);
  });
}

/** A clock on one line centred on a point, `w` design pixels wide. */
function clockAt(f: Frame, name: string, cx: number, cy: number, w: number, style: Style): void {
  const h = f.lines(style.size ?? 40, 1, 1.2);
  f.add("time", name, cx - f.px(w) / 2, cy - h / 2, f.px(w), h, { align: "center", ...style });
}

/** The sound as bars, `w` frame pixels wide from `x`. */
function bars(f: Frame, x: number, w: number, h: number, color: string, gap = 0, style: Style = {}): Block {
  return row(f, h, gap, (y, height) => f.add("visual", "main", x, y, w, height, { visual: "bars", color, ...style }));
}

/** A drawn icon from the bundled set, `size` design pixels square, in the layer's colour. */
function icon(f: Frame, name: string, glyph: GlyphName, x: number, y: number, size: number, color: string, opacity = 1, style: Style = {}): void {
  f.add("graphic", name, x, y, f.px(size), f.px(size), { art: GLYPHS[glyph], color, opacity, ...style });
}

/** One of a row of stats: a figure, or one of the clip's clocks, over a small icon and what the figure counts. */
type Stat = ({ text: string } | { clock: Exclude<Clock, "both"> }) & { glyph: GlyphName; label: string };

interface StatLook {
  value: Style;
  label: Style;
  /** The icons' colour and how strongly they show; the labels take the same. */
  ink: string;
  dim: number;
}

/** Stats side by side across the column, each a figure over an icon and its label, as a status card shows them. */
function stats(f: Frame, c: Column, items: Stat[], look: StatLook, gap = 0): Block {
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
const SHOW: Stat[] = [
  { text: "Ep. 00", glyph: "microphone", label: "Episode" },
  { clock: "elapsed", glyph: "headphones", label: "Played" },
  { clock: "remaining", glyph: "clock", label: "Left" },
];

// How faint a secondary line of words goes, a handle or a label: a 1080 frame shows at about a third of its size in a
// phone's feed, so words that carry something are never fainter than this nor smaller than 26.
const QUIET = 0.78;

/* ---------------------------------------------------------------------------------------------------------------- */

/** The reference itself: a lake in golden morning fog, and over it a pane of smoked glass counting the clip off in a
 *  ring of dots round a dot-matrix percentage, three small stats along its foot, the fog left to show all round it. */
const amberFog = template("amber-fog", "Amber Fog", { color: "#4a3a22", to: "#1f170c", angle: 180 }, INK, (f) => {
  // Half a sepia pushed hard turns the grey fog gold; the full amber tone went mustard in the mid-tones.
  backdrop(f, "4a139be3", { filter: "retro", adjust: { brightness: 0.9, saturation: 2 }, crop: { x: f.by({ square: 0.2, portrait: 0.25, story: 0.3, landscape: 0 }), y: 0, zoom: 1 }, loop: "slowZoom" });
  // Smoked dark enough that the words still to come, drawn at half strength, read over the brightest of the fog.
  const pane: Glass = { tint: "#1f0f05", strength: 0.5, frost: 30, corner: 48, edge: 2 };
  const title: Style = { font: INTER, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 34 }), weight: 600, color: WHITE };
  const name: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 500, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#f4e6c9", ink: "#4d3a1c" };
  const words: Style = { font: INTER, size: f.by({ square: 46, portrait: 50, story: 58, landscape: 52 }), weight: 600, color: WHITE, highlight: WHITE, align: "center" };
  const figures: StatLook = { value: { font: INTER, size: f.by({ square: 34, portrait: 38, story: 44, landscape: 40 }), weight: 500, color: WHITE }, label: { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400 }, ink: WHITE, dim: QUIET };
  const percent = (size: number) => (cx: number) => (cy: number) => clockAt(f, "main", cx, cy, size * 2.6, { clock: "percent", font: DOTS, size, weight: 300, color: WHITE });
  const a = area(f);

  if (f.wide) {
    const x = f.px(200);
    const y = f.px(130);
    const w = f.width - x * 2;
    const h = f.height - y * 2;
    glass(f, "card", x, y, w, h, pane);
    const left = x + f.px(340);
    stack(y, y + h, [ring(f, left, 540, WHITE, percent(150)(left))]);
    const right = column(x + f.px(680), x + w - f.px(64));
    stack(y + f.px(60), y + h - f.px(60), [
      header(f, right, title, name, 72, portrait),
      space(),
      captions(f, right, { ...words, align: "left" }, 3),
      space(),
      stats(f, right, SHOW, figures),
    ]);
    return;
  }
  const w = f.by({ square: 840, portrait: 860, story: 900, landscape: 0 });
  const x = (f.width - f.px(w)) / 2;
  const inset = f.by({ square: 44, portrait: 50, story: 58, landscape: 0 });
  const inner = column(x + f.px(inset), x + f.px(w) - f.px(inset));
  const blocks: Blocks = [
    header(f, inner, title, name, f.by({ square: 64, portrait: 72, story: 80, landscape: 0 }), portrait),
    ring(f, f.width / 2, f.by({ square: 230, portrait: 350, story: 460, landscape: 0 }), WHITE, percent(f.by({ square: 76, portrait: 110, story: 140, landscape: 0 }))(f.width / 2), f.by({ square: 14, portrait: 30, story: 50, landscape: 0 })),
    captions(f, inner, words, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 }), f.by({ square: 14, portrait: 28, story: 44, landscape: 0 })),
    stats(f, inner, SHOW, figures, f.by({ square: 20, portrait: 34, story: 54, landscape: 0 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  card(f, "card", x, a.top + (a.h - h) / 2, f.px(w), inset, pane, blocks);
});

/** A lone tree in fog, toned a deep cool slate: the words large on the photo itself, and a sheet of dark glass along
 *  the foot holding the speaker inside a ring of dots, their name and the time. */
const slateMist = template("slate-mist", "Slate Mist", { color: "#2c3640", to: "#131a21", angle: 180 }, INK, (f) => {
  // Graded down and hard, so the fog the words sit on is dark enough for the ones still to come and the tree stands
  // out of it, instead of grey on grey.
  backdrop(f, "ff81826c", { filter: "slate", adjust: { brightness: 0.42, contrast: 1.6 }, crop: { x: f.by({ square: 0.4, portrait: 0.5, story: 0.6, landscape: 0.2 }), y: 0, zoom: 1 }, loop: "slowZoom" });
  const pane: Glass = { tint: "#0b1117", strength: 0.36, frost: 28, corner: 44, edge: 1.5 };
  const title: Style = { font: DM_SANS, size: f.by({ square: 40, portrait: 46, story: 52, landscape: 46 }), weight: 500, color: WHITE, shadow: true };
  const words: Style = { font: DM_SANS, size: f.by({ square: 56, portrait: 62, story: 70, landscape: 62 }), weight: 600, color: WHITE, highlight: "#e9f1f7", shadow: true, lineHeight: 1.24 };
  const name: Style = { font: DM_SANS, size: f.by({ square: 32, portrait: 34, story: 38, landscape: 36 }), weight: 600, color: WHITE };
  const handle: Style = { font: DM_SANS, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 400, color: WHITE, opacity: QUIET };
  const time: Style = { font: DOTS, size: f.by({ square: 62, portrait: 64, story: 70, landscape: 68 }), weight: 400, color: WHITE, clock: "elapsed" };
  const portrait: Portrait = { fill: "#d7e2ea", ink: "#22303b" };
  const a = area(f);

  /** The ring of dots with the speaker in it, `d` across, and their name, handle and the time beside it. */
  const speaker = (c: Column, d: number, gap = 0): Block => {
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const timeH = f.lines(time.size!, 1, 1.2);
    return row(f, d, gap, (y, h) => {
      f.add("visual", "main", c.x, y, h, h, { visual: "ring", color: WHITE });
      avatarAt(f, c.x + h / 2, y + h / 2, d * 0.66, portrait);
      const x = c.x + h + f.px(36);
      const w = c.x + c.w - x;
      const top = y + (h - nameH - handleH - timeH - f.px(10)) / 2;
      f.add("name", "main", x, top, w, nameH, { align: "left", ...name });
      f.add("handle", "main", x, top + nameH, w, handleH, { align: "left", ...handle });
      f.add("time", "main", x, top + nameH + handleH + f.px(10), w, timeH, { align: "left", ...time });
    });
  };

  if (f.wide) {
    const left = column(a.left, f.px(1080));
    stack(a.top, a.bottom, [heading(f, left, title, 2), space(), captions(f, left, words, 4), space(0.4)]);
    const x = f.px(1180);
    const inner = column(x + f.px(48), a.right - f.px(48));
    const sheet: Blocks = [speaker(inner, 250)];
    const h = measure(sheet) + f.px(96);
    card(f, "card", x, a.bottom - h, a.right - x, 48, pane, sheet);
    return;
  }
  const c = column(a.left, a.right);
  const d = f.by({ square: 200, portrait: 230, story: 260, landscape: 0 });
  const inset = f.by({ square: 40, portrait: 44, story: 50, landscape: 0 });
  const sheetH = f.px(d + inset * 2);
  stack(a.top, a.bottom - sheetH, [heading(f, c, title, 2), space(), captions(f, c, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 0 })), space(0.5)]);
  card(f, "card", a.left, a.bottom - sheetH, a.w, inset, pane, [speaker(column(a.left + f.px(inset), a.right - f.px(inset)), d)]);
});

/** A grey sea under a pale horizon, toned in ash: light type on a card in the sky, a long strip of bars, and the
 *  title set thin over the water. */
const ashHorizon = template("ash-horizon", "Ash Horizon", { color: "#4a4b4d", to: "#202123", angle: 180 }, INK, (f) => {
  backdrop(f, "562ff8ce", { filter: "ash", adjust: { brightness: 0.6, contrast: 1.2 }, crop: { x: 0, y: f.by({ square: 0, portrait: 0, story: 0, landscape: 0.3 }), zoom: 1 }, loop: "slowZoom" });
  // The card sits in the pale sky, so its tint is what keeps the words still to come readable.
  const pane: Glass = { tint: "#141517", strength: 0.46, frost: 26, corner: 40, edge: 1.5 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 52, portrait: 60, story: 66, landscape: 64 }), weight: 300, color: WHITE, shadow: true, lineHeight: 1.1 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 28, story: 30, landscape: 28 }), weight: 500, color: WHITE };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 400, color: WHITE, opacity: QUIET };
  const words: Style = { font: OUTFIT, size: f.by({ square: 50, portrait: 54, story: 62, landscape: 54 }), weight: 400, color: WHITE, highlight: WHITE, lineHeight: 1.26 };
  const figures: StatLook = { value: { font: OUTFIT, size: f.by({ square: 34, portrait: 36, story: 42, landscape: 38 }), weight: 400, color: WHITE }, label: { font: OUTFIT, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400 }, ink: WHITE, dim: QUIET };
  const portrait: Portrait = { fill: "#e6e6e4", ink: "#2b2c2e", rim: WHITE };
  const a = area(f);

  const top = (c: Column, d: number): Block => byline(f, c, d, portrait, name, handle);

  if (f.wide) {
    const x = a.left;
    const w = f.px(1040);
    const inner = column(x + f.px(52), x + w - f.px(52));
    card(f, "card", x, a.top, w, 52, pane, [top(inner, 64), captions(f, inner, words, 4, 40), bars(f, inner.x, inner.w, 64, WHITE, 36), stats(f, inner, SHOW, figures, 40)]);
    const right = column(f.px(1220), a.right);
    stack(a.top, a.bottom, [space(), heading(f, right, title, 4)]);
    return;
  }
  const c = column(a.left, a.right);
  const inner = column(a.left + f.px(48), a.right - f.px(48));
  const h = card(f, "card", a.left, a.top, a.w, f.by({ square: 44, portrait: 48, story: 54, landscape: 0 }), pane, [
    top(inner, f.by({ square: 58, portrait: 64, story: 72, landscape: 0 })),
    captions(f, inner, words, 3, f.by({ square: 26, portrait: 36, story: 50, landscape: 0 })),
    bars(f, inner.x, inner.w, f.by({ square: 50, portrait: 60, story: 76, landscape: 0 }), WHITE, f.by({ square: 22, portrait: 32, story: 44, landscape: 0 })),
    stats(f, inner, SHOW, figures, f.by({ square: 26, portrait: 36, story: 50, landscape: 0 })),
  ]);
  stack(a.top + h, a.bottom, [space(), heading(f, c, title, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 }))]);
});

/** A city out of focus at night under dark glass, set out like a phone's widgets: the time in a ring of dots, the
 *  speaker, and a wide pane for the words. */
const nightGlass = template("night-glass", "Night Glass", { color: "#141824", to: "#07080d", angle: 180 }, INK, (f) => {
  backdrop(f, "5d9b67b8", { adjust: { brightness: 0.9, saturation: 1.15 }, crop: { x: f.by({ square: 0, portrait: 0.1, story: 0.1, landscape: 0 }), y: 0, zoom: 1.05 }, loop: "slowZoom" });
  // Dark enough over the brightest of the lights for the words still to come.
  const pane: Glass = { tint: "#0b0e18", strength: 0.5, frost: 34, corner: 44, edge: 1.5 };
  const amber = "#ffc46b";
  const title: Style = { font: GROTESK, size: f.by({ square: 27, portrait: 28, story: 32, landscape: 30 }), weight: 500, color: WHITE, opacity: 0.82 };
  const words: Style = { font: GROTESK, size: f.by({ square: 50, portrait: 56, story: 64, landscape: 58 }), weight: 600, color: WHITE, highlight: amber, lineHeight: 1.26 };
  const name: Style = { font: GROTESK, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 34 }), weight: 600, color: WHITE };
  const handle: Style = { font: GROTESK, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#262b3a", ink: WHITE, rim: WHITE };
  const a = area(f);
  const gutter = f.px(24);
  const inset = f.px(f.by({ square: 34, portrait: 38, story: 44, landscape: 40 }));

  /** The time widget: a ring of dots in amber with the time played in dot-matrix figures inside. */
  const clockWidget = (x: number, y: number, side: number) => {
    glass(f, "clock", x, y, side, side, pane);
    const d = side - inset * 2;
    f.add("visual", "ring", x + inset, y + inset, d, d, { visual: "ring", color: amber });
    clockAt(f, "main", x + side / 2, y + side / 2, (d * 0.8) / f.unit, { clock: "elapsed", font: DOTS, size: Math.round((d / f.unit) * 0.22), weight: 300, color: WHITE });
  };
  /** The speaker widget: their photo at the top left, name and handle along the foot. */
  const speakerWidget = (x: number, y: number, w: number, h: number) => {
    glass(f, "speaker", x, y, w, h, pane);
    const d = Math.min(150, ((h - inset * 2) / f.unit) * 0.48);
    avatarAt(f, x + inset + f.px(d) / 2, y + inset + f.px(d) / 2, d, portrait);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const nameH = f.lines(name.size!, 1, 1.3);
    f.add("handle", "main", x + inset, y + h - inset - handleH, w - inset * 2, handleH, { align: "left", ...handle });
    f.add("name", "main", x + inset, y + h - inset - handleH - nameH, w - inset * 2, nameH, { align: "left", ...name });
    icon(f, "live", "broadcast", x + w - inset - f.px(30), y + inset, 30, amber);
  };

  if (f.wide) {
    const side = (a.h - gutter) / 2;
    clockWidget(a.left, a.top, side);
    speakerWidget(a.left, a.top + side + gutter, side, side);
    const x = a.left + side + gutter;
    glass(f, "card", x, a.top, a.right - x, a.h, pane);
    const inner = column(x + inset * 1.4, a.right - inset * 1.4);
    stack(a.top + inset * 1.4, a.bottom - inset * 1.4, [heading(f, inner, title, 2), space(), captions(f, inner, words, 5), space(), bars(f, inner.x, f.px(360), 56, amber)]);
    return;
  }
  const side = (a.w - gutter) / 2;
  clockWidget(a.left, a.top, side);
  speakerWidget(a.left + side + gutter, a.top, side, side);
  const y = a.top + side + gutter;
  glass(f, "card", a.left, y, a.w, a.bottom - y, pane);
  const inner = column(a.left + inset * 1.2, a.right - inset * 1.2);
  stack(y + inset * 1.2, a.bottom - inset * 1.2, [
    heading(f, inner, title, 2),
    space(),
    captions(f, inner, words, f.by({ square: 2, portrait: 4, story: 6, landscape: 0 })),
    space(),
    bars(f, inner.x, f.px(300), f.by({ square: 40, portrait: 48, story: 60, landscape: 0 }), amber),
  ]);
});

/** Light glass on a pale relief of white clay, two discs of colour held behind it so the glass shows them only as soft
 *  washes that drift. */
const paleGlass = template("pale-glass", "Pale Glass", { color: "#f1efea", to: "#e3e0d8", angle: 160 }, PAPER, (f) => {
  backdrop(f, "bff9611c", { adjust: { brightness: 1.06, saturation: 0.2, contrast: 0.9 } });
  const ink = "#1c1c1f";
  const a = area(f);
  const pane: Glass = { tint: WHITE, strength: 0.5, frost: 48, corner: 48, edge: 2 };
  const title: Style = { font: DM_SANS, size: f.by({ square: 40, portrait: 46, story: 52, landscape: 48 }), weight: 700, color: ink, lineHeight: 1.12 };
  const words: Style = { font: DM_SANS, size: f.by({ square: 48, portrait: 54, story: 62, landscape: 56 }), weight: 600, color: ink, highlight: ink, lineHeight: 1.28 };
  const name: Style = { font: DM_SANS, size: f.by({ square: 26, portrait: 28, story: 31, landscape: 29 }), weight: 600, color: ink };
  const handle: Style = { font: DM_SANS, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 400, color: ink, opacity: QUIET };
  const time: Style = { font: DM_SANS, size: f.by({ square: 28, portrait: 29, story: 31, landscape: 29 }), weight: 600, color: ink, opacity: 0.85 };
  const portrait: Portrait = { fill: "#1c1c1f", ink: "#f1efea" };

  /** The sound and the time on one line. */
  const foot = (c: Column, h: number, gap: number): Block => row(f, h, gap, (y, height) => {
    f.add("visual", "main", c.x, y, f.px(260), height, { visual: "bars", color: ink });
    const timeH = f.lines(time.size!, 1, 1.3);
    f.add("time", "main", c.x + c.w - f.px(280), y + (height - timeH) / 2, f.px(280), timeH, { ...time, align: "right" });
  });

  const x = f.wide ? f.px(300) : a.left + f.px(20);
  const w = f.wide ? f.width - x * 2 : a.w - f.px(40);
  const inset = f.by({ square: 48, portrait: 54, story: 60, landscape: 64 });
  const inner = column(x + f.px(inset), x + w - f.px(inset));
  const blocks: Blocks = [
    byline(f, inner, f.by({ square: 60, portrait: 64, story: 72, landscape: 64 }), portrait, name, handle),
    heading(f, inner, title, f.by({ square: 2, portrait: 3, story: 3, landscape: 2 }), f.by({ square: 26, portrait: 36, story: 50, landscape: 30 })),
    captions(f, inner, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 3 }), f.by({ square: 24, portrait: 36, story: 50, landscape: 30 })),
    foot(inner, f.by({ square: 40, portrait: 46, story: 54, landscape: 48 }), f.by({ square: 28, portrait: 40, story: 56, landscape: 34 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  const y = f.wide ? (f.height - h) / 2 : a.top + (a.h - h) / 2;
  // Inside the card's outline, so outside it the page stays clean and inside only their blur shows.
  const side = Math.min(w, h) * 0.62;
  const disc = (name: string, cx: number, cy: number, color: string) => f.add("shape", name, cx - side / 2, cy - side / 2, side, side, { shape: "ellipse", fill: color, loop: "float" });
  disc("disc-warm", x + side / 2 + f.px(24), y + side / 2 + f.px(24), "#f3a47e");
  disc("disc-cool", x + w - side / 2 - f.px(24), y + h - side / 2 - f.px(24), "#8db2ea");
  card(f, "card", x, y, w, inset, pane, blocks);
});

/** A music player's now-playing screen: the words above as lyrics, the speaker as the artwork on a dark glass player
 *  with the sound as its scrubber, the time either side and the controls under it. */
const nowPlaying = template("now-playing", "Now Playing", { color: "#3a2a1c", to: "#120d08", angle: 180 }, INK, (f) => {
  // Headphones on a warm desk, out of focus behind the player; Editorial has the microphone.
  backdrop(f, "c357fca2", { adjust: { brightness: 0.52, saturation: 1.1, blur: 16 }, crop: { x: 0, y: 0, zoom: 1.1 } });
  const pane: Glass = { tint: "#120c06", strength: 0.34, frost: 30, corner: 44, edge: 1.5 };
  const words: Style = { font: INTER, size: f.by({ square: 54, portrait: 62, story: 70, landscape: 64 }), weight: 700, color: WHITE, highlight: WHITE, lineHeight: 1.22 };
  const title: Style = { font: INTER, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 34 }), weight: 600, color: WHITE };
  const name: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 500, color: WHITE, opacity: QUIET };
  const time: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 500, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#e9d6bd", ink: "#3a2a1c" };
  const a = area(f);

  /** The scrubber: the sound as a strip of bars, the time played under its left end and the time left under its right. */
  const scrubber = (c: Column, h: number, gap: number): Block => {
    const timeH = f.lines(time.size!, 1, 1.3);
    return row(f, h + 8 + time.size! * 1.3, gap, (y) => {
      f.add("visual", "main", c.x, y, c.w, f.px(h), { visual: "bars", color: WHITE });
      f.add("time", "elapsed", c.x, y + f.px(h + 8), f.px(180), timeH, { ...time, align: "left", clock: "elapsed" });
      f.add("time", "remaining", c.x + c.w - f.px(180), y + f.px(h + 8), f.px(180), timeH, { ...time, align: "right", clock: "remaining" });
    });
  };
  /** Like, pause and share, the pause larger and in the middle. */
  const controls = (cx: number, size: number, gap: number): Block => row(f, size, gap, (y, h) => {
    const small = size * 0.62;
    const apart = f.px(size * 2.2);
    icon(f, "like", "heart", cx - apart - f.px(small) / 2, y + (h - f.px(small)) / 2, small, WHITE, 0.72);
    icon(f, "pause", "pause", cx - h / 2, y, size, WHITE);
    icon(f, "share", "share-network", cx + apart - f.px(small) / 2, y + (h - f.px(small)) / 2, small, WHITE, 0.72);
  });

  if (f.wide) {
    const w = f.px(620);
    const inner = column(a.left + f.px(52), a.left + w - f.px(52));
    const art = 300;
    glass(f, "card", a.left, a.top, w, a.h, pane);
    stack(a.top + f.px(52), a.bottom - f.px(52), [
      row(f, art, 0, (y, h) => avatarAt(f, a.left + w / 2, y + h / 2, art, portrait)),
      space(),
      row(f, name.size! * 1.3, 0, (y, h) => f.add("name", "main", inner.x, y, inner.w, h, { align: "left", ...name })),
      heading(f, inner, title, 3, 4),
      scrubber(inner, 52, 30),
      controls(a.left + w / 2, 58, 30),
    ]);
    const right = column(a.left + w + f.px(90), a.right);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 5), space()]);
    return;
  }
  const c = column(a.left, a.right);
  const inset = f.by({ square: 40, portrait: 44, story: 50, landscape: 0 });
  const inner = column(a.left + f.px(inset), a.right - f.px(inset));
  const art = f.by({ square: 96, portrait: 112, story: 128, landscape: 0 });
  // The artist over room for two lines of the title, so a short title leaves its spare line below, as header() does.
  const nameH = f.lines(name.size!, 1, 1.3);
  const titleH = titleRoom(f, title.size!, 1.2);
  const player: Blocks = [
    row(f, Math.max(art, (nameH + titleH) / f.unit + 4), 0, (y, h) => {
      avatarAt(f, inner.x + f.px(art) / 2, y + h / 2, art, portrait);
      const x = inner.x + f.px(art) + f.px(26);
      const top = y + (h - nameH - titleH - f.px(4)) / 2;
      f.add("name", "main", x, top, inner.x + inner.w - x, nameH, { align: "left", ...name });
      f.add("title", "main", x, top + nameH + f.px(4), inner.x + inner.w - x, titleH, { align: "left", ...title, lineHeight: 1.2 });
    }),
    scrubber(inner, f.by({ square: 40, portrait: 48, story: 56, landscape: 0 }), f.by({ square: 26, portrait: 34, story: 44, landscape: 0 })),
    controls(f.width / 2, f.by({ square: 48, portrait: 54, story: 62, landscape: 0 }), f.by({ square: 18, portrait: 26, story: 36, landscape: 0 })),
  ];
  const h = measure(player) + f.px(inset) * 2;
  stack(a.top, a.bottom - h, [space(), captions(f, c, words, f.by({ square: 3, portrait: 5, story: 6, landscape: 0 })), space(0.6)]);
  card(f, "card", a.left, a.bottom - h, a.w, inset, pane, player);
});

/** The time as the hero: a large dot-matrix clock in warm amber on near-black, the words under it. */
const dotClock = template("dot-clock", "Dot Clock", { color: "#121212", to: "#0a0a0a", angle: 180 }, INK, (f) => {
  const amber = "#ffb547";
  // Handjet is narrow, so it is set about as large as a saved design keeps a size (400); light, so it reads as dots.
  const hero: Style = { font: DOTS, size: f.by({ square: 360, portrait: 400, story: 400, landscape: 400 }), weight: 220, color: amber, clock: "elapsed", enter: "flicker", lineHeight: 1 };
  const words: Style = { font: GROTESK, size: f.by({ square: 50, portrait: 56, story: 64, landscape: 58 }), weight: 600, color: "#f5f1ea", highlight: amber, lineHeight: 1.26 };
  const title: Style = { font: GROTESK, size: f.by({ square: 27, portrait: 28, story: 31, landscape: 30 }), weight: 500, color: "#f5f1ea", opacity: QUIET };
  const name: Style = { font: GROTESK, size: f.by({ square: 27, portrait: 28, story: 31, landscape: 30 }), weight: 600, color: "#f5f1ea" };
  const handle: Style = { font: GROTESK, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: "#f5f1ea", opacity: QUIET };
  const left: Style = { font: DOTS, size: f.by({ square: 54, portrait: 56, story: 62, landscape: 60 }), weight: 400, color: amber, opacity: QUIET, clock: "remaining" };
  const portrait: Portrait = { fill: amber, ink: "#1a1205" };
  const a = area(f);

  /** The big clock, the time left small under its start: Handjet is narrow, so the hero fills only part of the column
   *  and a right-aligned time left would stand alone at the far edge. */
  const clockBlock = (c: Column, gap = 0): Block => {
    const heroH = f.lines(hero.size!, 1, 1);
    const leftH = f.lines(left.size!, 1, 1.2);
    return { h: heroH + leftH, gap: f.px(gap), draw: (y) => {
      f.add("time", "main", c.x, y, c.w, heroH, { align: "left", ...hero });
      f.add("time", "left", c.x, y + heroH, c.w, leftH, { align: "left", ...left });
    } };
  };

  if (f.wide) {
    const clockSide = column(a.left, f.px(1060));
    stack(a.top, a.bottom, [heading(f, clockSide, title, 2), space(), clockBlock(clockSide), space(), bars(f, clockSide.x, f.px(420), 60, amber)]);
    const right = column(f.px(1160), a.right);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 5), space(), byline(f, right, 68, portrait, name, handle)]);
    return;
  }
  const c = column(a.left, a.right);
  stack(a.top, a.bottom, [
    byline(f, c, f.by({ square: 60, portrait: 64, story: 72, landscape: 0 }), portrait, name, handle),
    space(0.7),
    clockBlock(c),
    bars(f, c.x, f.px(320), f.by({ square: 44, portrait: 50, story: 60, landscape: 0 }), amber, f.by({ square: 10, portrait: 16, story: 24, landscape: 0 })),
    space(0.5),
    captions(f, c, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 0 })),
    space(0.7),
    heading(f, c, title, 2),
  ]);
});

/** A page of words: the captions set very large on warm paper, marked as they are said in highlighter yellow, and one
 *  hairline above the speaker. */
const bigType = template("big-type", "Big Type", { color: "#f2f0eb" }, PAPER, (f) => {
  const ink = "#151515";
  const words: Style = { font: BRICOLAGE, size: f.by({ square: 74, portrait: 84, story: 92, landscape: 88 }), weight: 700, color: ink, highlight: "#ffd84d", lineHeight: 1.12, letterSpacing: -20 };
  const title: Style = { font: BRICOLAGE, size: f.by({ square: 28, portrait: 30, story: 33, landscape: 32 }), weight: 600, color: ink };
  const episode: Style = { font: BRICOLAGE, size: f.by({ square: 28, portrait: 30, story: 33, landscape: 32 }), weight: 500, color: ink, opacity: QUIET, align: "right" };
  const name: Style = { font: BRICOLAGE, size: f.by({ square: 27, portrait: 28, story: 31, landscape: 30 }), weight: 600, color: ink };
  const handle: Style = { font: BRICOLAGE, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: ink, opacity: QUIET };
  const portrait: Portrait = { fill: ink, ink: "#f2f0eb" };
  const a = area(f);

  /** Room for two lines of the title on the left of the top line, the episode on the right of its first. */
  const top = (c: Column): Block => {
    const h = titleRoom(f, title.size!, 1.25);
    return { h, gap: 0, draw: (y) => {
      f.add("title", "main", c.x, y, c.w * 0.72, h, { align: "left", ...title, lineHeight: 1.25 });
      f.add("text", "episode", c.x + c.w * 0.72, y, c.w * 0.28, f.lines(episode.size!, 1, 1.25), { text: "Ep. 00", lineHeight: 1.25, ...episode });
    } };
  };
  /** The speaker on the left of the foot, the sound on the right. */
  const foot = (c: Column, d: number): Block => byline(f, c, d, portrait, name, handle, 0, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(220), y + (h - f.px(44)) / 2, f.px(220), f.px(44), { visual: "bars", color: ink });
  });

  const c = column(a.left, a.right);
  if (f.wide) {
    stack(a.top, a.bottom, [top(c), space(), captions(f, column(a.left, f.px(1500)), words, 5), space(), rule(f, c, "rule", ink, 1), foot(c, 64)]);
    return;
  }
  stack(a.top, a.bottom, [
    top(c),
    space(),
    captions(f, c, words, f.by({ square: 5, portrait: 7, story: 9, landscape: 0 })),
    space(),
    rule(f, c, "rule", ink, 1),
    foot(c, f.by({ square: 60, portrait: 64, story: 72, landscape: 0 })),
  ]);
});

/** A photo of blue hills and a dark page side by side, the speaker on a glass chip laid across the seam, so half of it
 *  frosts the photo and half the page. Its tint is a shade lighter than the page, so the half on the page still shows
 *  as glass instead of vanishing into it. */
const splitFrame = template("split-frame", "Split Frame", { color: "#111519" }, INK, (f) => {
  const pale = "#e8eef2";
  const pane: Glass = { tint: "#2a3540", strength: 0.55, frost: 26, corner: 40, edge: 1.5 };
  const title: Style = { font: ARCHIVO, size: f.by({ square: 40, portrait: 50, story: 54, landscape: 48 }), weight: 600, color: pale, lineHeight: 1.1 };
  const words: Style = { font: ARCHIVO, size: f.by({ square: 48, portrait: 54, story: 62, landscape: 58 }), weight: 500, color: pale, highlight: "#bcd7e6", lineHeight: 1.28 };
  const name: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 28, story: 31, landscape: 30 }), weight: 600, color: WHITE };
  const handle: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: WHITE, opacity: QUIET };
  const time: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 500, color: pale, opacity: QUIET };
  const portrait: Portrait = { fill: "#bcd7e6", ink: "#111519" };
  const a = area(f);

  /** The sound and the time, side by side. */
  const foot = (c: Column, h: number, gap = 0): Block => row(f, h, gap, (y, height) => {
    f.add("visual", "main", c.x, y, f.px(300), height, { visual: "bars", color: "#9fc0d2" });
    const timeH = f.lines(time.size!, 1, 1.3);
    f.add("time", "main", c.x + f.px(330), y + (height - timeH) / 2, f.px(300), timeH, { align: "left", ...time });
  });
  /** The chip: the speaker's photo with their name and handle beside it, on glass. */
  const chip = (x: number, y: number, w: number, d: number) => {
    const inset = 26;
    const inner = column(x + f.px(inset), x + w - f.px(inset));
    card(f, "chip", x, y, w, inset, pane, [byline(f, inner, d, portrait, name, handle)]);
    return f.px(d + inset * 2);
  };

  if (f.wide) {
    const seam = f.px(860);
    panel(f, "c68c792e", 0, 0, seam, f.height, { crop: { x: 0.3, y: 0, zoom: 1 }, loop: "slowZoom" });
    chip(seam - f.px(250), a.bottom - f.px(140), f.px(500), 88);
    const right = column(seam + f.px(110), a.right);
    stack(a.top, a.bottom, [heading(f, right, title, 2), space(), captions(f, right, words, 5), space(), foot(right, 52)]);
    return;
  }
  const seam = f.height * f.by({ square: 0.4, portrait: 0.44, story: 0.42, landscape: 0 });
  panel(f, "c68c792e", 0, 0, f.width, seam, { loop: "slowZoom" });
  const d = f.by({ square: 72, portrait: 84, story: 96, landscape: 0 });
  const chipH = f.px(d + 52);
  chip(a.left, seam - chipH / 2, f.px(f.by({ square: 520, portrait: 560, story: 620, landscape: 0 })), d);
  const c = column(a.left, a.right);
  stack(seam + chipH / 2 + f.px(f.by({ square: 30, portrait: 44, story: 60, landscape: 0 })), a.bottom, [
    heading(f, c, title, 2),
    space(),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 5, landscape: 0 })),
    space(),
    foot(c, f.by({ square: 40, portrait: 46, story: 56, landscape: 0 })),
  ]);
});

/** The sea at sunset, full bleed, and the words in a glass pill near the foot, as captions sit on a video. */
const captionPill = template("caption-pill", "Caption Pill", { color: "#3a2a2a", to: "#140d10", angle: 180 }, INK, (f) => {
  backdrop(f, "79f1d53f", { adjust: { brightness: 0.92 }, crop: { x: 0, y: 0, zoom: 1 }, loop: "slowZoom" });
  const pane: Glass = { tint: "#100a0c", strength: 0.44, frost: 24, corner: 999, edge: 1.5 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 40, portrait: 46, story: 52, landscape: 48 }), weight: 600, color: WHITE, shadow: true, lineHeight: 1.12 };
  const words: Style = { font: OUTFIT, size: f.by({ square: 50, portrait: 54, story: 60, landscape: 56 }), weight: 600, color: WHITE, highlight: WHITE, align: "center", lineHeight: 1.25 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 27, portrait: 28, story: 31, landscape: 30 }), weight: 600, color: WHITE, shadow: true };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: WHITE, opacity: 0.85, shadow: true };
  const portrait: Portrait = { fill: "#ffd9b8", ink: "#3a2a2a", rim: WHITE };
  const a = area(f);
  const c = column(a.left, a.right);
  const lines = 2;
  const inset = f.by({ square: 30, portrait: 32, story: 36, landscape: 32 });
  const pillW = f.wide ? f.px(1400) : a.w;
  const pillX = (f.width - pillW) / 2;
  const inner = column(pillX + f.px(64), pillX + pillW - f.px(64));
  const pill: Blocks = [captions(f, inner, words, lines)];
  const pillH = measure(pill) + f.px(inset) * 2;
  const pillY = a.bottom - pillH;

  stack(a.top, pillY, [
    byline(f, c, f.by({ square: 60, portrait: 64, story: 72, landscape: 64 }), portrait, name, handle),
    heading(f, column(a.left, f.wide ? f.px(1200) : a.right), title, 2, f.by({ square: 22, portrait: 30, story: 40, landscape: 28 })),
    space(),
    bars(f, f.width / 2 - f.px(120), f.px(240), f.by({ square: 44, portrait: 50, story: 60, landscape: 52 }), WHITE, 0),
    space(0.12),
  ]);
  card(f, "pill", pillX, pillY, pillW, inset, pane, pill);
});

/** A magazine page in black and white: a microphone in mono across the top, a serif headline, the words in a plain
 *  sans, hairlines between. */
const editorial = template("editorial", "Editorial", { color: "#f5f4f0" }, PAPER, (f) => {
  const ink = "#111111";
  const title: Style = { font: SERIF, size: f.by({ square: 58, portrait: 72, story: 82, landscape: 80 }), weight: 400, color: ink, lineHeight: 1.04, letterSpacing: -10 };
  const words: Style = { font: INTER, size: f.by({ square: 46, portrait: 50, story: 58, landscape: 54 }), weight: 500, color: ink, highlight: ink, lineHeight: 1.3 };
  const meta: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 600, color: ink, uppercase: true, letterSpacing: 120 };
  const name: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 600, color: ink };
  const handle: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: ink, opacity: QUIET };
  const portrait: Portrait = { fill: ink, ink: "#f5f4f0" };
  const a = area(f);

  /** The episode on the left of a line, the clip's time on the right, in small spaced capitals. */
  const metaRow = (c: Column, gap = 0): Block => {
    const h = f.lines(meta.size!, 1, 1.25);
    return { h, gap: f.px(gap), draw: (y) => {
      const lineH = f.lines(meta.size!, 1, 1);
      f.add("text", "episode", c.x, y + (h - lineH) / 2, c.w / 2, lineH, { text: "Episode 00", align: "left", ...meta, lineHeight: 1 });
      f.add("time", "main", c.x + c.w / 2, y, c.w / 2, h, { align: "right", lineHeight: 1.25, ...meta });
    } };
  };
  const foot = (c: Column, d: number): Block => byline(f, c, d, portrait, name, handle, 0, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(180), y + (h - f.px(36)) / 2, f.px(180), f.px(36), { visual: "bars", color: ink });
  });
  const mono: PhotoLook = { filter: "mono", adjust: { contrast: 1.05 } };

  if (f.wide) {
    const photoW = f.px(780);
    panel(f, "b878edc4", a.left, a.top, photoW, a.h, mono);
    const c = column(a.left + photoW + f.px(80), a.right);
    stack(a.top, a.bottom, [metaRow(c), rule(f, c, "rule", ink, 1, 14), heading(f, c, title, 4, 28), space(), captions(f, c, words, 4), space(), rule(f, c, "rule-foot", ink, 1), foot(c, 60)]);
    return;
  }
  const c = column(a.left, a.right);
  const photoH = f.px(f.by({ square: 300, portrait: 440, story: 600, landscape: 0 }));
  panel(f, "b878edc4", a.left, a.top, a.w, photoH, mono);
  stack(a.top + photoH, a.bottom, [
    metaRow(c, f.by({ square: 22, portrait: 28, story: 40, landscape: 0 })),
    rule(f, c, "rule", ink, 1, 12),
    heading(f, c, title, 3, f.by({ square: 18, portrait: 26, story: 36, landscape: 0 })),
    space(),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 4, landscape: 0 })),
    space(),
    rule(f, c, "rule-foot", ink, 1),
    foot(c, f.by({ square: 52, portrait: 58, story: 66, landscape: 0 })),
  ]);
});

/** Pale dunes at dusk, the words large over the sky, and a band of glass the full width of the frame carrying the
 *  speaker, the sound and the time. */
const glassBand = template("glass-band", "Glass Band", { color: "#5a4a45", to: "#241b19", angle: 180 }, INK, (f) => {
  // Taken down to dusk: at full light the sky and sand were too pale for the words still to come.
  backdrop(f, "3b47c880", { adjust: { brightness: 0.56, contrast: 1.1 }, crop: { x: f.by({ square: 0.2, portrait: 0.2, story: 0.3, landscape: 0 }), y: 0, zoom: 1 }, loop: "slowZoom" });
  const pane: Glass = { tint: WHITE, strength: 0.14, frost: 26, corner: 0, edge: 1.5 };
  const title: Style = { font: DM_SANS, size: f.by({ square: 34, portrait: 38, story: 42, landscape: 40 }), weight: 500, color: WHITE, opacity: 0.9, shadow: true };
  const words: Style = { font: DM_SANS, size: f.by({ square: 56, portrait: 64, story: 72, landscape: 66 }), weight: 700, color: WHITE, highlight: WHITE, shadow: true, align: "center", lineHeight: 1.2 };
  const name: Style = { font: DM_SANS, size: f.by({ square: 28, portrait: 30, story: 33, landscape: 32 }), weight: 600, color: WHITE };
  const handle: Style = { font: DM_SANS, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 400, color: WHITE, opacity: QUIET };
  const time: Style = { font: DOTS, size: f.by({ square: 62, portrait: 64, story: 70, landscape: 68 }), weight: 400, color: WHITE, clock: "elapsed" };
  const portrait: Portrait = { fill: "#f3e3da", ink: "#4a3833", rim: WHITE };
  const a = area(f);
  const c = column(a.left, a.right);
  const d = f.by({ square: 76, portrait: 84, story: 96, landscape: 88 });
  const inset = f.by({ square: 34, portrait: 38, story: 44, landscape: 40 });
  const bandH = f.px(d + inset * 2);
  const bandY = f.wide ? a.bottom - bandH : f.height * f.by({ square: 0.74, portrait: 0.74, story: 0.68, landscape: 0 }) - bandH / 2;

  glass(f, "band", 0, bandY, f.width, bandH, pane);
  stack(bandY + f.px(inset), bandY + bandH - f.px(inset), [byline(f, column(a.left, a.left + f.px(f.wide ? 560 : 440)), d, portrait, name, handle, 0, (y, h) => {
    const timeW = f.px(170);
    const timeH = f.lines(time.size!, 1, 1.2);
    f.add("time", "main", a.right - timeW, y + (h - timeH) / 2, timeW, timeH, { ...time, align: "right" });
    const barsX = a.left + f.px(f.wide ? 640 : 470);
    f.add("visual", "main", barsX, y + h * 0.18, a.right - timeW - f.px(30) - barsX, h * 0.64, { visual: "bars", color: WHITE });
  })]);
  stack(a.top, bandY - f.px(40), [heading(f, f.wide ? column(a.left, f.px(1100)) : c, title, 2), space(), captions(f, c, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 3 })), space(f.wide ? 0.5 : 0.8)]);
});

/** A studio microphone in the dark, and under it a smoked glass card: on air, the title, the words, the speaker and the
 *  sound as a wave. */
const studio = template("studio", "Studio", { color: "#17181a", to: "#08090a", angle: 180 }, INK, (f) => {
  backdrop(f, "d61ed0d3", { adjust: { brightness: 0.95, contrast: 1.05 }, crop: { x: f.by({ square: 0.1, portrait: 0.05, story: 0, landscape: 0 }), y: f.by({ square: -0.3, portrait: -0.3, story: -0.2, landscape: 0 }), zoom: f.by({ square: 1.1, portrait: 1.1, story: 1, landscape: 1 }) } });
  const pane: Glass = { tint: "#0c0d0f", strength: 0.4, frost: 30, corner: 40, edge: 1.5 };
  const red = "#ff4b3e";
  const air: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 700, color: WHITE, uppercase: true, letterSpacing: 140 };
  const title: Style = { font: ARCHIVO, size: f.by({ square: 38, portrait: 44, story: 48, landscape: 46 }), weight: 700, color: WHITE, lineHeight: 1.1 };
  const words: Style = { font: ARCHIVO, size: f.by({ square: 48, portrait: 52, story: 60, landscape: 54 }), weight: 500, color: WHITE, highlight: "#d92d20", lineHeight: 1.28 };
  const name: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 600, color: WHITE };
  const handle: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: WHITE, opacity: QUIET };
  const time: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 500, color: WHITE, opacity: QUIET, clock: "elapsed" };
  const portrait: Portrait = { fill: "#2a2c30", ink: WHITE, rim: WHITE };
  const a = area(f);

  /** A red light that breathes beside "On air", and the time played at the far right. */
  const onAir = (c: Column): Block => {
    const h = f.lines(air.size!, 1, 1.4);
    return { h, gap: 0, draw: (y) => {
      const dot = f.px(14);
      f.add("shape", "light", c.x, y + (h - dot) / 2, dot, dot, { shape: "ellipse", fill: red, loop: "flash" });
      f.add("text", "air", c.x + dot + f.px(14), y + (h - f.lines(air.size!, 1, 1.25)) / 2, f.px(300), f.lines(air.size!, 1, 1.25), { text: "On air", align: "left", lineHeight: 1.25, ...air });
      f.add("time", "main", c.x + c.w - f.px(200), y, f.px(200), h, { ...time, align: "right" });
    } };
  };
  const foot = (c: Column, d: number, gap: number): Block => byline(f, c, d, portrait, name, handle, gap, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(260), y + h * 0.15, f.px(260), h * 0.7, { visual: "wave", color: WHITE });
  });

  if (f.wide) {
    const x = f.px(1000);
    const inner = column(x + f.px(52), a.right - f.px(52));
    glass(f, "card", x, a.top, a.right - x, a.h, pane);
    stack(a.top + f.px(52), a.bottom - f.px(52), [onAir(inner), heading(f, inner, title, 3, 30), space(), captions(f, inner, words, 4), space(), foot(inner, 64, 0)]);
    return;
  }
  const inset = f.by({ square: 40, portrait: 46, story: 52, landscape: 0 });
  const inner = column(a.left + f.px(inset), a.right - f.px(inset));
  const blocks: Blocks = [
    onAir(inner),
    heading(f, inner, title, 2, f.by({ square: 18, portrait: 26, story: 36, landscape: 0 })),
    captions(f, inner, words, f.by({ square: 3, portrait: 3, story: 4, landscape: 0 }), f.by({ square: 18, portrait: 28, story: 40, landscape: 0 })),
    foot(inner, f.by({ square: 56, portrait: 62, story: 70, landscape: 0 }), f.by({ square: 22, portrait: 32, story: 44, landscape: 0 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  card(f, "card", a.left, a.bottom - h, a.w, inset, pane, blocks);
});

/** Rain on a window at dusk behind heavily frosted glass, the words set as a quotation in a fine serif. */
const rainWindow = template("rain-window", "Rain Window", { color: "#26303a", to: "#0f141a", angle: 180 }, INK, (f) => {
  backdrop(f, "57662708", { filter: "cool", adjust: { brightness: 0.68, saturation: 0.4 }, loop: "slowZoom" });
  const pane: Glass = { tint: "#0d141c", strength: 0.42, frost: 48, corner: 44, edge: 1.5 };
  const words: Style = { font: SERIF, size: f.by({ square: 58, portrait: 66, story: 74, landscape: 68 }), weight: 400, color: WHITE, highlight: "#dce8f2", lineHeight: 1.16 };
  const title: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 500, color: WHITE, opacity: 0.82 };
  const name: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 600, color: WHITE };
  const handle: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#c9d8e4", ink: "#1a242e", rim: WHITE };
  const a = area(f);
  /** An opening quote mark set in the words' own serif, `size` design pixels: a plain mark, where the drawn icon read
   *  as "99". The serif draws it in the top fifth of its letter's box, so the row, and the mark's own box (what the
   *  editor outlines when it is picked), are only that tall and stay clear of the words under it. */
  const quote = (c: Column, size: number, gap: number): Block => row(f, size * 0.3, gap, (y) => {
    f.add("text", "quote", c.x - f.px(size * 0.03), y, f.px(size * 0.5), f.px(size * 0.3), { text: "“", font: SERIF, size, lineHeight: 1, align: "left", color: WHITE, opacity: 0.6 });
  });
  const foot = (c: Column, d: number): Block => byline(f, c, d, portrait, name, handle, 0, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(170), y + (h - f.px(36)) / 2, f.px(170), f.px(36), { visual: "bars", color: WHITE });
  });

  const w = f.wide ? f.px(1280) : a.w;
  const x = (f.width - w) / 2;
  const inset = f.by({ square: 48, portrait: 56, story: 64, landscape: 60 });
  const inner = column(x + f.px(inset), x + w - f.px(inset));
  // The title leads, so a title of one line leaves its spare room above the quote mark rather than over the speaker.
  const blocks: Blocks = [
    heading(f, inner, title, 2),
    quote(inner, f.by({ square: 200, portrait: 230, story: 260, landscape: 210 }), f.by({ square: 26, portrait: 34, story: 44, landscape: 30 })),
    // Room for the longest page the editor shows and little more, so a short page doesn't float far under the mark.
    captions(f, inner, words, f.by({ square: 3, portrait: 4, story: 4, landscape: 3 }), f.by({ square: 10, portrait: 14, story: 20, landscape: 12 })),
    rule(f, inner, "rule", WHITE, 0.3, f.by({ square: 24, portrait: 34, story: 48, landscape: 30 })),
    foot(inner, f.by({ square: 56, portrait: 62, story: 70, landscape: 60 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  card(f, "card", x, a.top + (a.h - h) / 2, w, inset, pane, blocks);
});

/** Clouds over mountains, pale and cool: the speaker in the middle inside a ring of dots that fills as the clip plays,
 *  dark type, and a light pane of glass under the words. */
const halo = template("halo", "Halo", { color: "#d9dee3", to: "#b8c0c8", angle: 180 }, PAPER, (f) => {
  backdrop(f, "cf2511b2", { adjust: { brightness: 1.04, saturation: 0.55, contrast: 0.92 }, crop: { x: f.by({ square: 0.2, portrait: 0.25, story: 0.3, landscape: 0 }), y: f.by({ square: -0.4, portrait: -0.4, story: 0, landscape: -0.5 }), zoom: f.by({ square: 1.2, portrait: 1.15, story: 1, landscape: 1 }) }, loop: "slowZoom" });
  const ink = "#15191e";
  // Light enough that dark words still to come, at half strength, read on it over the darkest of the mountains.
  const pane: Glass = { tint: WHITE, strength: 0.7, frost: 28, corner: 40, edge: 2 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 38, portrait: 44, story: 50, landscape: 46 }), weight: 600, color: ink, align: "center", lineHeight: 1.1 };
  const words: Style = { font: OUTFIT, size: f.by({ square: 48, portrait: 52, story: 60, landscape: 54 }), weight: 500, color: ink, highlight: ink, align: "center", lineHeight: 1.26 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 34 }), weight: 600, color: ink, align: "center" };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 400, color: ink, opacity: QUIET, align: "center" };
  const portrait: Portrait = { fill: ink, ink: "#e9edf1", rim: WHITE };
  const a = area(f);

  /** The ring of dots, `d` across, with the speaker inside. */
  const speaker = (c: Column, d: number, gap = 0): Block => row(f, d, gap, (y, h) => {
    const cx = c.x + c.w / 2;
    f.add("visual", "main", cx - h / 2, y, h, h, { visual: "ring", color: ink });
    avatarAt(f, cx, y + h / 2, d * 0.7, portrait);
  });
  /** A light pane holding the speaker's name and handle over `lines` of the words, so dark type always has a light
   *  ground whatever the clouds do behind it. */
  const nameAndWords = (c: Column, lines: number, inset: number, gap = 0): Block => {
    const inner = column(c.x + f.px(inset), c.x + c.w - f.px(inset));
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const who = row(f, (nameH + handleH) / f.unit, 0, (y) => {
      f.add("name", "main", inner.x, y, inner.w, nameH, name);
      f.add("handle", "main", inner.x, y + nameH, inner.w, handleH, handle);
    });
    const body = captions(f, inner, words, lines, 22);
    const blocks = [who, body];
    return { h: measure(blocks) + f.px(inset) * 2, gap: f.px(gap), draw: (y) => card(f, "card", c.x, y, c.w, inset, pane, blocks) };
  };

  if (f.wide) {
    const left = column(a.left, f.px(760));
    stack(a.top, a.bottom, [space(), speaker(left, 480), space()]);
    const right = column(f.px(860), a.right);
    stack(a.top, a.bottom, [space(), heading(f, right, title, 2), nameAndWords(right, 3, 44, 40), space()]);
    return;
  }
  const c = column(a.left, a.right);
  stack(a.top, a.bottom, [
    heading(f, c, title, 2),
    space(),
    speaker(c, f.by({ square: 330, portrait: 440, story: 540, landscape: 0 })),
    space(),
    nameAndWords(c, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 }), f.by({ square: 30, portrait: 36, story: 44, landscape: 0 })),
  ]);
});

/** A live room, the way a Space looks while it is on: city light trails under dark glass, a red live tag, an
 *  invitation to listen, the host, and the words. */
const liveRoom = template("live-room", "Live Room", { color: "#2a1a10", to: "#0d0806", angle: 180 }, INK, (f) => {
  backdrop(f, "2ec6bb82", { adjust: { brightness: 0.62, saturation: 0.95, blur: 4 }, loop: "slowZoom" });
  const pane: Glass = { tint: "#0d0b0a", strength: 0.4, frost: 32, corner: 44, edge: 1.5 };
  const red = "#ff3b30";
  const tag: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 700, color: WHITE, uppercase: true, letterSpacing: 120 };
  const invite: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 500, color: WHITE, opacity: 0.85 };
  const title: Style = { font: INTER, size: f.by({ square: 40, portrait: 46, story: 48, landscape: 48 }), weight: 700, color: WHITE, lineHeight: 1.12, letterSpacing: -10 };
  const words: Style = { font: INTER, size: f.by({ square: 48, portrait: 52, story: 60, landscape: 54 }), weight: 600, color: WHITE, highlight: WHITE, lineHeight: 1.28 };
  const name: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 27 }), weight: 600, color: WHITE };
  const handle: Style = { font: INTER, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#ffcfb0", ink: "#2a1a10", rim: WHITE };
  const a = area(f);

  /** The red live tag on the left, an invitation to listen on the right: words, not a count of listeners, so an export
   *  nobody edited never claims an audience it did not have. */
  const top = (c: Column): Block => {
    const h = f.px(f.by({ square: 46, portrait: 46, story: 50, landscape: 46 }));
    return { h, gap: 0, draw: (y) => {
      const tagH = f.lines(tag.size!, 1, 1.25);
      const w = f.px(tag.size! * 4);
      f.add("shape", "tag", c.x, y, w, h, { shape: "rect", radius: 0.22, fill: red });
      f.add("text", "live", c.x + f.px(16), y + (h - tagH) / 2, w - f.px(24), tagH, { text: "Live", align: "left", lineHeight: 1.25, ...tag });
      const inviteH = f.lines(invite.size!, 1, 1.25);
      const glyph = invite.size! * 1.1;
      const textW = f.px(invite.size! * 4.8);
      f.add("text", "listen", c.x + c.w - textW, y + (h - inviteH) / 2, textW, inviteH, { text: "Listen in", align: "right", lineHeight: 1.25, ...invite });
      icon(f, "listen", "headphones", c.x + c.w - textW - f.px(glyph + 10), y + (h - f.px(glyph)) / 2, glyph, WHITE, 0.85);
    } };
  };
  const host = (c: Column, d: number, gap: number): Block => byline(f, c, d, portrait, name, handle, gap, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(240), y + h * 0.2, f.px(240), h * 0.6, { visual: "bars", color: WHITE });
  });

  const w = f.wide ? f.px(1360) : a.w;
  const x = (f.width - w) / 2;
  const inset = f.by({ square: 44, portrait: 50, story: 56, landscape: 52 });
  const inner = column(x + f.px(inset), x + w - f.px(inset));
  const blocks: Blocks = [
    top(inner),
    heading(f, inner, title, 2, f.by({ square: 26, portrait: 34, story: 46, landscape: 30 })),
    host(inner, f.by({ square: 60, portrait: 66, story: 76, landscape: 64 }), f.by({ square: 24, portrait: 32, story: 44, landscape: 28 })),
    rule(f, inner, "rule", WHITE, 0.18, f.by({ square: 22, portrait: 30, story: 40, landscape: 26 })),
    captions(f, inner, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 3 }), f.by({ square: 20, portrait: 28, story: 40, landscape: 24 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  card(f, "card", x, a.top + (a.h - h) / 2, w, inset, pane, blocks);
});

/** The podcast templates in the order the picker shows them. */
export const PODCAST_TEMPLATES: TemplateChoice[] = [
  amberFog,
  slateMist,
  nightGlass,
  paleGlass,
  nowPlaying,
  dotClock,
  captionPill,
  splitFrame,
  ashHorizon,
  glassBand,
  bigType,
  editorial,
  studio,
  rainWindow,
  halo,
  liveRoom,
];
