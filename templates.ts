/* Twenty-four ready-made looks for podcast and live audio clips. Eight are bold, the way a show's cover art is made:
   flat colour, big type, and shapes drawn in the frame. Sixteen are in a quiet modern manner: a single-tone photo
   carrying the mood, frosted glass floating over it, thin labels, a ring of dots or a dot-matrix clock for the time, a
   row of small stats. Each is laid out for every frame shape the editor offers. A template is only layers, so once it is picked
   every part of it can be moved, restyled or deleted, and the words on its labels are sample copy for the user to
   change. Free of the DOM, so it can be tested on its own. */
import { FRAME_SIZES, type Adjust, type Art, type Clock, type Crop, type Layer, type LayerKind, type Layout, type Page, type Template } from "@drkxbt/audiogram";
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
    f.add("visual", "ring", x + inset, y + inset, d, d, { visual: "ring", color: amber, keepLook: true });
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

/* ---------------------------------------------------------------------------------------------------------------- */
/* Bold cover-art looks: flat colour, big type and shapes drawn in the frame, the way a show's square artwork is made. */

const ANTON = "Anton";
const ARCHIVO_BLACK = "Archivo Black";
const SYNE = "Syne Variable";
const MONO = "Space Mono";
const PACIFICO = "Pacifico";
const FREDOKA = "Fredoka Variable";
const LUCKIEST = "Luckiest Guy";
const RIGHTEOUS = "Righteous";
const RALEWAY = "Raleway Variable";
const CAVEAT = "Caveat Variable";

// The warm dark theme: on a deep red page its muted words still read, where Ink's grey would not.
const EMBER = 4;

/**
 * Plain words on one line, their top at `y` and `x` the edge or middle they are set from. The box's width is a guess
 * from `advance`, how wide a letter of the face runs as a share of its size; right and centred words are drawn from the
 * box's right edge or middle, so a wrong guess never moves them, and the editor fits the box once it is touched.
 */
function label(f: Frame, name: string, text: string, x: number, y: number, style: Style, advance = 0.62): number {
  const size = style.size ?? 40;
  const w = f.px(size * text.length * (advance + (style.letterSpacing ?? 0) / 1000));
  const h = f.lines(size, 1, 1);
  const align = style.align ?? "left";
  f.add("text", name, align === "right" ? x - w : align === "center" ? x - w / 2 : x, y, w, h, { text, ...style, align, lineHeight: 1 });
  return h;
}

/** A length in a drawing, to a tenth: fine enough for a 1080 frame and short enough for a saved kit to keep. */
const tenth = (value: number) => Math.round(value * 10) / 10;

/** Rows of small waves across a `w` by `h` box, the squiggles a screen print is patterned with. */
function squiggles(w: number, h: number, rows: number, waves: number, width: number): Art {
  const step = h / rows;
  const half = (w - width * 2) / waves / 2;
  const rise = Math.min(step * 0.32, half * 0.7);
  let d = "";
  for (let r = 0; r < rows; r++) d += `M${tenth(width)} ${tenth(step * (r + 0.5))}q${tenth(half / 2)} ${tenth(-rise)} ${tenth(half)} 0${`t${tenth(half)} 0`.repeat(waves * 2 - 1)}`;
  return { w: tenth(w), h: tenth(h), paths: [{ d, stroke: "currentColor", width }] };
}

/** A grid of dots `gap` apart across a `w` by `h` box, like a halftone. */
function dots(w: number, h: number, gap: number, r: number): Art {
  let d = "";
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) d += `M${tenth(x - r)} ${tenth(y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  return { w: tenth(w), h: tenth(h), paths: [{ d, fill: "currentColor" }] };
}

/** Squares stepping in from the edges of a `w` by `h` frame, up to two deep along the top and foot and one at the
 *  sides, with a fainter one at some tips, as a pixel dissolve leaves them. The same frame always gets the same steps. */
function pixels(w: number, h: number, cell: number): Art {
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
function signoff(f: Frame, c: Column, d: number, portrait: Portrait, name: Style, handle: Style, color: string, gap = 0): Block {
  return byline(f, c, d, portrait, name, handle, gap, (y, h) => {
    f.add("visual", "main", c.x + c.w - f.px(220), y + (h - f.px(44)) / 2, f.px(220), f.px(44), { visual: "bars", color });
  });
}

/** A loud collage of flat shapes on pale peach: a cobalt blob, a red sun, a navy block printed with dots and a sky-blue
 *  card printed with squiggles, overlapping, and the title in heavy white capitals on a dark band laid across them. */
const colorCollage = template("color-collage", "Color Collage", { color: "#f6e5d9" }, PAPER, (f) => {
  const ink = "#16161a";
  const cobalt = "#2747d6";
  const navy = "#1b2a78";
  const title: Style = { font: ARCHIVO_BLACK, size: f.by({ square: 54, portrait: 60, story: 66, landscape: 64 }), weight: 400, color: WHITE, uppercase: true };
  const words: Style = { font: ARCHIVO, size: f.by({ square: 50, portrait: 56, story: 62, landscape: 56 }), weight: 700, color: ink, highlight: cobalt, lineHeight: 1.24 };
  const name: Style = { font: ARCHIVO, size: f.by({ square: 28, portrait: 29, story: 32, landscape: 30 }), weight: 700, color: ink };
  const handle: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 500, color: ink, opacity: QUIET };
  const tag: Style = { font: ARCHIVO_BLACK, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 28 }), weight: 400, color: WHITE, background: ink, align: "right" };
  const portrait: Portrait = { fill: cobalt, ink: WHITE };
  const inset = f.px(f.by({ square: 26, portrait: 30, story: 34, landscape: 30 }));
  const a = area(f);
  const c = column(a.left, a.right);

  /** The shapes, overlapping across the box they are given. */
  const collage = (x: number, y: number, w: number, h: number) => {
    f.add("shape", "blob", x + w * 0.02, y, w * 0.5, h * 0.72, { shape: "blob", fill: cobalt });
    const sun = Math.min(w, h) * 0.62;
    f.add("shape", "sun", x + w * 0.74 - sun / 2, y + h * 0.34 - sun / 2, sun, sun, { shape: "ellipse", fill: "#ef4130" });
    const block = { x: x + w * 0.3, y: y + h * 0.52, w: w * 0.3, h: h * 0.42 };
    f.add("shape", "block", block.x, block.y, block.w, block.h, { shape: "rect", fill: navy });
    f.add("graphic", "dots", block.x, block.y, block.w, block.h, { art: dots(block.w, block.h, f.px(22), f.px(3.5)), color: "#8fb8ff" });
    const card = { x: x + w * 0.6, y: y + h * 0.62, w: w * 0.32, h: h * 0.3 };
    f.add("shape", "card", card.x, card.y, card.w, card.h, { shape: "rect", fill: "#a9d3f6", rotation: -12 });
    f.add("graphic", "squiggle", card.x, card.y, card.w, card.h, { art: squiggles(card.w, card.h, 5, 5, f.px(7)), color: navy, rotation: -12 });
  };
  const bandHeight = (count: number) => f.lines(title.size!, count, 1.05) + f.px(2) + inset * 2;
  /** The band across the whole frame, its top at `y`, with room in it for `count` lines of the title. */
  const band = (y: number, count: number) => {
    f.add("shape", "band", 0, y, f.width, bandHeight(count), { shape: "rect", fill: "#141a42", opacity: 0.94 });
    f.add("title", "main", c.x, y + inset, c.w, bandHeight(count) - inset * 2, { align: "left", ...title, lineHeight: 1.05 });
  };

  if (f.wide) {
    collage(a.left, a.top, f.px(860), a.h);
    const y = (f.height - bandHeight(3)) / 2;
    band(y, 3);
    label(f, "ep", "Ep. 00", a.right, a.top, tag, 0.72);
    const right = column(f.px(1020), a.right);
    stack(a.top, y - f.px(36), [space(), signoff(f, right, 64, portrait, name, handle, cobalt)]);
    stack(y + bandHeight(3) + f.px(36), a.bottom, [captions(f, right, words, 3), space()]);
    return;
  }
  const zone = f.px(f.by({ square: 520, portrait: 720, story: 900, landscape: 0 }));
  collage(a.left, a.top, a.w, zone);
  // Capitals in Archivo Black run wide, so a long title gets a line more than its words would need in a narrower face.
  const count = f.by({ square: 3, portrait: 4, story: 4, landscape: 0 });
  band(a.top + zone * 0.5 - bandHeight(count) / 2, count);
  label(f, "ep", "Ep. 00", a.right, a.top, tag, 0.72);
  stack(a.top + zone + f.px(f.by({ square: 30, portrait: 40, story: 50, landscape: 0 })), a.bottom, [
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 4, landscape: 0 })),
    space(),
    signoff(f, c, f.by({ square: 60, portrait: 64, story: 72, landscape: 0 }), portrait, name, handle, cobalt),
  ]);
});

/** The speaker's photo large on white, cut across by a band of electric blue carrying the show's name in lowercase
 *  and the sound, thin blue stripes running in behind the photo. */
const portraitBand = template("portrait-band", "Portrait Band", { color: "#ffffff" }, PAPER, (f) => {
  const ink = "#111111";
  const vivid = "#1f3bff";
  const mark: Style = { font: SYNE, size: f.by({ square: 76, portrait: 84, story: 90, landscape: 92 }), weight: 800, color: WHITE, letterSpacing: -30 };
  const title: Style = { font: SYNE, size: f.by({ square: 40, portrait: 44, story: 50, landscape: 46 }), weight: 700, color: ink, lineHeight: 1.12 };
  const words: Style = { font: SYNE, size: f.by({ square: 48, portrait: 54, story: 62, landscape: 56 }), weight: 600, color: ink, highlight: vivid, lineHeight: 1.26 };
  const kicker: Style = { font: SYNE, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 28 }), weight: 700, color: vivid, uppercase: true, letterSpacing: 140 };
  const name: Style = { font: SYNE, size: f.by({ square: 34, portrait: 36, story: 40, landscape: 38 }), weight: 700, color: ink };
  const handle: Style = { font: SYNE, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 28 }), weight: 500, color: ink, opacity: QUIET };
  const a = area(f);

  /** The episode over the speaker's name and handle. */
  const who = (c: Column): Block => {
    const kickH = f.lines(kicker.size!, 1, 1);
    const between = f.px(16);
    const nameH = f.lines(name.size!, 1, 1.25);
    const handleH = f.lines(handle.size!, 1, 1.3);
    return { h: kickH + between + nameH + handleH, gap: 0, draw: (y) => {
      label(f, "ep", "Ep. 00", c.x, y, kicker, 0.7);
      f.add("name", "main", c.x, y + kickH + between, c.w, nameH, { align: "left", ...name });
      f.add("handle", "main", c.x, y + kickH + between + nameH, c.w, handleH, { align: "left", ...handle });
    } };
  };

  const d = f.px(f.by({ square: 470, portrait: 600, story: 740, landscape: 820 }));
  const x = f.wide ? a.left : f.width - d - f.px(36);
  const y = f.wide ? (f.height - d) / 2 : a.top;
  const bandH = f.px(f.by({ square: 150, portrait: 170, story: 190, landscape: 180 }));
  const bandY = y + d * 0.6;
  // Drawn before the photo, so they run in behind it; on a wide frame they stop at its middle, clear of the words.
  const stripes = f.wide ? x + d / 2 : f.width;
  for (const step of [1, 2, 3]) f.add("shape", `stripe-${step}`, 0, bandY - f.px(28 * step), stripes, f.px(12), { shape: "rect", fill: vivid });
  f.add("avatar", "main", x, y, d, d, { fill: "#dfe4ff", color: vivid });
  f.add("shape", "band", 0, bandY, f.width, bandH, { shape: "rect", fill: vivid });
  label(f, "mark", "your show", f.wide ? f.px(960) : a.left, bandY + (bandH - f.lines(mark.size!, 1, 1)) / 2, mark, 0.56);
  f.add("visual", "main", a.right - f.px(170), bandY + bandH * 0.3, f.px(170), bandH * 0.4, { visual: "bars", color: WHITE });

  if (f.wide) {
    const right = column(f.px(960), a.right);
    stack(a.top, bandY - f.px(30), [who(right), space(), heading(f, right, title, 3)]);
    stack(bandY + bandH + f.px(26), a.bottom, [captions(f, right, words, 2), space()]);
    return;
  }
  stack(a.top, bandY - f.px(100), [who(column(a.left, x - f.px(30))), space()]);
  const c = column(a.left, a.right);
  stack(bandY + bandH + f.px(f.by({ square: 30, portrait: 40, story: 50, landscape: 0 })), a.bottom, [
    heading(f, c, title, 2),
    space(0.5),
    captions(f, c, words, f.by({ square: 3, portrait: 3, story: 4, landscape: 0 })),
    space(),
  ]);
});

/** A soft wash of pastels framed by white squares stepping in from the edges, the title in clean centred capitals and
 *  small spaced labels in the corners. */
const pastelPixel = template("pastel-pixel", "Pastel Pixel", { color: "#f9d3e6", to: "#cfe5f8", angle: 135 }, PAPER, (f) => {
  const ink = "#17171c";
  const lilac = "#6a4cf0";
  const title: Style = { font: GROTESK, size: f.by({ square: 60, portrait: 68, story: 76, landscape: 72 }), weight: 500, color: ink, uppercase: true, align: "center", letterSpacing: -20 };
  const words: Style = { font: GROTESK, size: f.by({ square: 46, portrait: 50, story: 58, landscape: 54 }), weight: 500, color: ink, highlight: lilac, align: "center", lineHeight: 1.26 };
  const corner: Style = { font: GROTESK, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 600, color: ink, uppercase: true, letterSpacing: 120 };
  const portrait: Portrait = { fill: WHITE, ink: lilac };
  const a = area(f);
  const side = Math.min(f.width, f.height);

  // Discs of colour under one sheet of frosted glass, which melts them into a wash; each kept inside the frame.
  const washes: Array<[string, number, number, number]> = [
    ["#ffb3d6", 0.24, 0.22, 0.62],
    ["#fff0a0", 0.76, 0.26, 0.56],
    ["#ffd0a6", 0.5, 0.5, 0.5],
    ["#aef0d8", 0.26, 0.76, 0.6],
    ["#c9b8ff", 0.76, 0.76, 0.6],
  ];
  washes.forEach(([color, cx, cy, size], index) => {
    const d = side * size;
    const x = Math.min(Math.max(0, f.width * cx - d / 2), f.width - d);
    const y = Math.min(Math.max(0, f.height * cy - d / 2), f.height - d);
    f.add("shape", `wash-${index + 1}`, x, y, d, d, { shape: "ellipse", fill: color });
  });
  f.add("shape", "haze", 0, 0, f.width, f.height, { shape: "rect", fill: WHITE, opacity: 0.16, frost: 60 });
  const cell = f.px(50);
  f.add("graphic", "pixels", 0, 0, f.width, f.height, { art: pixels(f.width, f.height, cell), color: WHITE });

  // The labels sit just inside the deepest steps: two squares at the top and foot, one at the sides.
  const lineH = f.lines(corner.size!, 1, 1);
  const left = cell + f.px(44);
  const right = f.width - left;
  const top = Math.max(a.top, cell * 2 + f.px(34));
  const foot = Math.min(a.bottom, f.height - cell * 2 - f.px(34)) - lineH;
  label(f, "show", "Podcast", left, top, corner, 0.66);
  label(f, "ep", "Ep. 00", right, top, { ...corner, align: "right" }, 0.66);
  label(f, "by", "By", left, foot, corner, 0.66);
  const by = f.px(corner.size! * 2 * 0.8 + 14);
  const nameH = f.lines(corner.size!, 1, 1.3);
  f.add("name", "main", left + by, foot - (nameH - lineH) / 2, f.width / 2 - left - by, nameH, { align: "left", ...corner });
  const clockH = f.lines(corner.size!, 1, 1.3);
  f.add("time", "main", right - f.px(260), foot - (clockH - lineH) / 2, f.px(260), clockH, { align: "right", clock: "remaining", ...corner });

  const c = f.wide ? column(f.px(360), f.width - f.px(360)) : column(a.left + f.px(40), a.right - f.px(40));
  const d = f.by({ square: 92, portrait: 104, story: 120, landscape: 96 });
  stack(top + lineH + f.px(40), foot - f.px(40), [
    space(),
    row(f, d, 0, (y, h) => avatarAt(f, f.width / 2, y + h / 2, d, portrait)),
    heading(f, c, title, f.by({ square: 3, portrait: 3, story: 4, landscape: 3 }), f.by({ square: 26, portrait: 34, story: 44, landscape: 28 })),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 3, landscape: 2 }), f.by({ square: 18, portrait: 26, story: 36, landscape: 20 })),
    bars(f, f.width / 2 - f.px(110), f.px(220), f.by({ square: 40, portrait: 44, story: 50, landscape: 44 }), ink, f.by({ square: 16, portrait: 22, story: 30, landscape: 18 })),
    space(),
  ]);
});

/** Flat signal yellow and a red drawing of a microphone and headphones leaning in to each other, sparks flying, the
 *  title typed in mono capitals on black label bars. */
const signalYellow = template("signal-yellow", "Signal Yellow", { color: "#ffe500" }, PAPER, (f) => {
  const ink = "#111111";
  const red = "#d42020";
  const title: Style = { font: MONO, size: f.by({ square: 42, portrait: 46, story: 52, landscape: 48 }), weight: 700, color: "#ffe500", background: ink, uppercase: true };
  const words: Style = { font: MONO, size: f.by({ square: 46, portrait: 50, story: 56, landscape: 52 }), weight: 700, color: ink, highlight: red, lineHeight: 1.3 };
  const name: Style = { font: MONO, size: f.by({ square: 28, portrait: 29, story: 32, landscape: 30 }), weight: 700, color: ink };
  const handle: Style = { font: MONO, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 27 }), weight: 400, color: ink, opacity: QUIET };
  const portrait: Portrait = { fill: red, ink: "#ffe500" };
  const a = area(f);

  /** The drawing, across the box it is given. */
  const drawing = (x: number, y: number, w: number, h: number) => {
    const size = Math.min(h * 0.9, w * 0.46) / f.unit;
    const top = y + (h - f.px(size)) / 2;
    icon(f, "microphone", "microphone", x + w * 0.27 - f.px(size) / 2, top, size, red, 1, { rotation: -14 });
    icon(f, "headphones", "headphones", x + w * 0.72 - f.px(size * 0.9) / 2, top + f.px(size * 0.08), size * 0.9, red, 1, { rotation: 12 });
    const sparks: Array<[number, number, number]> = [[0.5, 0.18, 0.16], [0.56, 0.36, 0.09], [0.45, 0.7, 0.11]];
    sparks.forEach(([sx, sy, ss], index) => {
      const s = f.px(size) * ss;
      f.add("shape", `spark-${index + 1}`, x + w * sx - s / 2, y + h * sy - s / 2, s, s, { shape: "sparkle", fill: red });
    });
  };
  /** The title on its bars; the bars reach past the words by a fifth of their size, so the words sit that far in. */
  const titled = (c: Column, gap = 0) => heading(f, column(c.x + f.px(title.size! * 0.22), c.x + c.w - f.px(title.size! * 0.22)), { ...title, lineHeight: 1.42 }, 3, gap);

  if (f.wide) {
    drawing(a.left, a.top, f.px(800), a.h);
    const right = column(f.px(960), a.right);
    stack(a.top, a.bottom, [space(), titled(right), captions(f, right, words, 3, 34), space(), signoff(f, right, 64, portrait, name, handle, ink)]);
    return;
  }
  const zone = f.px(f.by({ square: 360, portrait: 480, story: 620, landscape: 0 }));
  drawing(a.left, a.top, a.w, zone);
  const c = column(a.left, a.right);
  stack(a.top + zone + f.px(f.by({ square: 28, portrait: 40, story: 50, landscape: 0 })), a.bottom, [
    titled(c),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 4, landscape: 0 }), f.by({ square: 24, portrait: 34, story: 44, landscape: 0 })),
    space(),
    signoff(f, c, f.by({ square: 60, portrait: 64, story: 72, landscape: 0 }), portrait, name, handle, ink),
  ]);
});

/** Deep red, a row of round cartoon faces with the speaker's photo among them, and the title in a big white script
 *  under the show's name in spaced capitals. */
const scriptRed = template("script-red", "Script Red", { color: "#b8141f", to: "#920d18", angle: 180 }, EMBER, (f) => {
  const cream = "#fff3e2";
  const yellow = "#ffd23f";
  const dark = "#2a0a0c";
  const title: Style = { font: PACIFICO, size: f.by({ square: 62, portrait: 72, story: 80, landscape: 74 }), weight: 400, color: WHITE, align: "center", lineHeight: 1.3 };
  const kicker: Style = { font: ARCHIVO_BLACK, size: f.by({ square: 26, portrait: 28, story: 30, landscape: 28 }), weight: 400, color: cream, uppercase: true, letterSpacing: 260, align: "center" };
  const words: Style = { font: FREDOKA, size: f.by({ square: 48, portrait: 54, story: 60, landscape: 56 }), weight: 600, color: cream, highlight: yellow, align: "center", lineHeight: 1.26 };
  const name: Style = { font: FREDOKA, size: f.by({ square: 28, portrait: 30, story: 33, landscape: 31 }), weight: 600, color: cream, align: "center" };
  const portrait: Portrait = { fill: "#ffd9b8", ink: "#b8141f", rim: cream };
  const a = area(f);

  /** A cartoon head: hair peeking over it, two dot eyes and a smile. */
  const face = (n: number, cx: number, cy: number, d: number, skin: string, hair: string) => {
    f.add("shape", `hair-${n}`, cx - d * 0.54, cy - d * 0.64, d * 1.08, d * 0.84, { shape: "ellipse", fill: hair });
    f.add("shape", `face-${n}`, cx - d / 2, cy - d / 2, d, d, { shape: "ellipse", fill: skin });
    const eye = d * 0.1;
    for (const [side, dx] of [["left", -0.17], ["right", 0.17]] as const) {
      f.add("shape", `eye-${n}-${side}`, cx + d * dx - eye / 2, cy - d * 0.06 - eye / 2, eye, eye, { shape: "ellipse", fill: dark });
    }
    f.add("shape", `smile-${n}`, cx - d * 0.18, cy + d * 0.12, d * 0.36, d * 0.14, { shape: "line", fill: dark, strokeWidth: round((d * 0.05) / f.unit), bend: -70, cap: "round" });
  };
  /** Four heads in a row about `cx`, the speaker's photo second. */
  const faces = (cx: number, d: number, gap = 0): Block => row(f, d * 1.14, gap, (y, h) => {
    const cy = y + h - f.px(d) / 2;
    const step = f.px(d) * 1.3;
    const at = (slot: number) => cx + (slot - 1.5) * step;
    face(1, at(0), cy, f.px(d), "#ffe1c4", yellow);
    avatarAt(f, at(1), cy, d, portrait);
    face(2, at(2), cy, f.px(d), "#f2b48c", dark);
    face(3, at(3), cy, f.px(d), "#ffd9b8", "#ff8fa3");
  });
  const named = (c: Column, gap = 0) => row(f, name.size! * 1.3, gap, (y, h) => f.add("name", "main", c.x, y, c.w, h, { ...name }));
  const show = (cx: number, gap = 0) => row(f, kicker.size!, gap, (y) => label(f, "show", "Your show", cx, y, kicker, 0.78));

  if (f.wide) {
    const left = column(a.left, f.px(860));
    const cx = left.x + left.w / 2;
    stack(a.top, a.bottom, [space(), faces(cx, 140), named(left, 26), bars(f, cx - f.px(130), f.px(260), 52, cream, 40), space()]);
    const right = column(f.px(940), a.right);
    const mid = right.x + right.w / 2;
    stack(a.top, a.bottom, [space(), show(mid), heading(f, right, title, 3, 20), captions(f, right, words, 2, 24), space()]);
    return;
  }
  const c = column(a.left, a.right);
  stack(a.top, a.bottom, [
    faces(f.width / 2, f.by({ square: 136, portrait: 166, story: 188, landscape: 0 })),
    named(c, f.by({ square: 14, portrait: 20, story: 26, landscape: 0 })),
    space(0.6),
    show(f.width / 2),
    heading(f, c, title, 3, f.by({ square: 12, portrait: 18, story: 24, landscape: 0 })),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 4, landscape: 0 }), f.by({ square: 14, portrait: 22, story: 32, landscape: 0 })),
    space(),
    // Wide and tall enough that any sound style reads, a wave as well as bars.
    bars(f, f.width / 2 - f.px(180), f.px(360), f.by({ square: 56, portrait: 64, story: 72, landscape: 0 }), cream),
  ]);
});

/** Neon green filled edge to edge by the title in huge condensed black capitals, stacked line on line, the show's
 *  name running down the right edge like a book's spine. */
const giantType = template("giant-type", "Giant Type", { color: "#3dff1f" }, PAPER, (f) => {
  const ink = "#0b0b0b";
  const title: Style = { font: ANTON, size: f.by({ square: 108, portrait: 126, story: 140, landscape: 136 }), weight: 400, color: ink, uppercase: true };
  const words: Style = { font: ARCHIVO, size: f.by({ square: 48, portrait: 54, story: 60, landscape: 56 }), weight: 800, color: ink, highlight: ink, lineHeight: 1.22 };
  const spine: Style = { font: ARCHIVO_BLACK, size: f.by({ square: 28, portrait: 30, story: 32, landscape: 30 }), weight: 400, color: ink, uppercase: true, letterSpacing: 160, align: "center" };
  const name: Style = { font: ARCHIVO, size: f.by({ square: 28, portrait: 29, story: 32, landscape: 30 }), weight: 800, color: ink };
  const handle: Style = { font: ARCHIVO, size: f.by({ square: 26, portrait: 27, story: 29, landscape: 28 }), weight: 500, color: ink, opacity: QUIET };
  const portrait: Portrait = { fill: ink, ink: "#3dff1f" };
  const a = area(f);

  // Turned a quarter, so it reads down the edge; its box is laid flat, then turned about its middle.
  const text = "Your show · Ep. 00";
  const across = f.px(spine.size! * text.length * (0.74 + spine.letterSpacing! / 1000));
  const thick = f.lines(spine.size!, 1, 1);
  f.add("text", "spine", a.right - thick / 2 - across / 2, a.top + across / 2 - thick / 2, across, thick, { text, ...spine, lineHeight: 1, rotation: 90 });
  const edge = a.right - thick - f.px(36);
  const big = (c: Column, count: number): Block => heading(f, c, { ...title, lineHeight: 0.96 }, count);

  if (f.wide) {
    stack(a.top, a.bottom, [space(), big(column(a.left, f.px(1160)), 5), space()]);
    const right = column(f.px(1240), edge);
    stack(a.top, a.bottom, [space(), captions(f, right, words, 4), space(), signoff(f, right, 64, portrait, name, handle, ink)]);
    return;
  }
  const c = column(a.left, edge);
  stack(a.top, a.bottom, [
    big(c, f.by({ square: 5, portrait: 5, story: 6, landscape: 0 })),
    space(),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 4, landscape: 0 })),
    space(0.5),
    signoff(f, c, f.by({ square: 60, portrait: 64, story: 72, landscape: 0 }), portrait, name, handle, ink),
  ]);
});

/** A retro space poster on deep navy: stars and ringed planets cut from flat colour, the speaker in a ring of dots like
 *  a moon in orbit, the title in chunky yellow capitals with a stepped shadow, and a cream strip
 *  along the foot with a tagline. */
const retroPoster = template("retro-poster", "Retro Poster", { color: "#1b2150", to: "#0e1233", angle: 180 }, INK, (f) => {
  const cream = "#f6e7c8";
  const yellow = "#ffcf5a";
  const orange = "#ff6b35";
  const teal = "#3fc1c9";
  const navy = "#141a40";
  const title: Style = { font: LUCKIEST, size: f.by({ square: 62, portrait: 70, story: 78, landscape: 72 }), weight: 400, color: yellow, effect: "echo", align: "center", lineHeight: 1.1 };
  const words: Style = { font: RIGHTEOUS, size: f.by({ square: 48, portrait: 54, story: 60, landscape: 56 }), weight: 400, color: cream, highlight: yellow, align: "center", lineHeight: 1.26 };
  const name: Style = { font: RIGHTEOUS, size: f.by({ square: 30, portrait: 32, story: 35, landscape: 33 }), weight: 400, color: cream, align: "center" };
  const tagline: Style = { font: RIGHTEOUS, size: f.by({ square: 26, portrait: 28, story: 30, landscape: 28 }), weight: 400, color: navy, uppercase: true, letterSpacing: 140, align: "center" };
  const portrait: Portrait = { fill: orange, ink: navy };
  const a = area(f);

  // On a story the strip runs on to the frame's foot, its words kept above the band the apps cover.
  const stripH = f.px(f.by({ square: 96, portrait: 104, story: 104, landscape: 96 }));
  const stripTop = f.tall ? a.bottom - stripH : f.height - stripH;
  const sky = stripTop - f.px(24);

  const stars: Array<[number, number, number, "star" | "sparkle"]> = [
    [0.07, 0.05, 30, "star"], [0.93, 0.08, 24, "sparkle"], [0.5, 0.03, 18, "sparkle"], [0.2, 0.3, 18, "sparkle"],
    [0.85, 0.34, 30, "star"], [0.05, 0.52, 20, "sparkle"], [0.95, 0.57, 18, "sparkle"], [0.1, 0.8, 28, "star"],
    [0.9, 0.86, 20, "sparkle"], [0.36, 0.95, 16, "sparkle"], [0.66, 0.93, 24, "star"],
  ];
  stars.forEach(([sx, sy, size, shape], index) => {
    const s = f.px(size);
    f.add("shape", `star-${index + 1}`, f.width * sx - s / 2, Math.max(0, sky * sy - s / 2), s, s, { shape, fill: index % 3 ? cream : yellow, opacity: 0.9 });
  });
  /** A planet of `d` across centred on a point, with a tilted ring round it when it has one. */
  const planet = (n: number, cx: number, cy: number, d: number, fill: string, ring?: string) => {
    f.add("shape", `planet-${n}`, cx - d / 2, cy - d / 2, d, d, { shape: "ellipse", fill });
    if (ring) f.add("shape", `orbit-${n}`, cx - d * 0.9, cy - d * 0.25, d * 1.8, d * 0.5, { shape: "ring", fill: ring, rotation: -16 });
  };
  const orbit = (d: number, gap = 0) => ring(f, f.width / 2, d, cream, (cy) => avatarAt(f, f.width / 2, cy, d * 0.6, portrait), gap);
  const named = (c: Column, gap = 0) => row(f, name.size! * 1.3, gap, (y, h) => f.add("name", "main", c.x, y, c.w, h, { ...name }));

  f.add("shape", "strip", 0, stripTop, f.width, f.height - stripTop, { shape: "rect", fill: cream });
  label(f, "tagline", "A tagline for your show", f.width / 2, stripTop + (stripH - f.lines(tagline.size!, 1, 1)) / 2, tagline, 0.62);

  if (f.wide) {
    planet(1, f.px(1780), f.px(190), f.px(120), orange, teal);
    planet(2, f.px(1180), f.px(760), f.px(64), teal);
    f.add("shape", "moon", f.px(1240), f.px(130), f.px(70), f.px(70), { shape: "moon", fill: cream });
    const left = column(a.left, f.px(1080));
    stack(a.top, sky, [space(), heading(f, left, title, 3), captions(f, left, words, 3, 40), space()]);
    const right = column(f.px(1180), a.right);
    stack(a.top, sky, [space(), ring(f, f.px(1510), 440, cream, (cy) => avatarAt(f, f.px(1510), cy, 264, portrait)), named(right, 20), space()]);
    return;
  }
  const c = column(a.left, a.right);
  const d = f.by({ square: 230, portrait: 300, story: 380, landscape: 0 });
  const planets = (gap: number): Block => {
    const inner = orbit(d, gap);
    return { ...inner, draw: (y, h) => {
      const cy = y + h / 2;
      const big = f.px(f.by({ square: 140, portrait: 160, story: 180, landscape: 0 }));
      planet(1, f.width * 0.16, cy - h * 0.18, big, orange, teal);
      planet(2, f.width * 0.86, cy + h * 0.24, f.px(70), teal);
      f.add("shape", "moon", f.width * 0.8, cy - h * 0.42, f.px(64), f.px(64), { shape: "moon", fill: cream });
      inner.draw(y, h);
    } };
  };
  stack(a.top, sky, [
    heading(f, c, title, 3),
    space(),
    planets(0),
    named(c, f.by({ square: 10, portrait: 16, story: 22, landscape: 0 })),
    space(),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 })),
    space(0.4),
  ]);
});

/** Warm yellow, the speaker's photo as a big round cut-out low at the left with a soft shadow under it, their name in
 *  a hand over the title in thin, widely spaced capitals at the top right. */
const sunnyPortrait = template("sunny-portrait", "Sunny Portrait", { color: "#fbd54c", to: "#f6c531", angle: 160 }, PAPER, (f) => {
  const ink = "#1d1a14";
  const rust = "#8a3510";
  const title: Style = { font: RALEWAY, size: f.by({ square: 46, portrait: 52, story: 58, landscape: 56 }), weight: 300, color: ink, uppercase: true, letterSpacing: 80, align: "right", lineHeight: 1.12 };
  const name: Style = { font: CAVEAT, size: f.by({ square: 42, portrait: 46, story: 50, landscape: 48 }), weight: 600, color: rust, align: "right" };
  const words: Style = { font: RALEWAY, size: f.by({ square: 46, portrait: 50, story: 58, landscape: 54 }), weight: 600, color: ink, highlight: ink, align: "right", lineHeight: 1.26 };
  const tag: Style = { font: RALEWAY, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 27 }), weight: 700, color: ink, uppercase: true, letterSpacing: 160, align: "right" };
  const a = area(f);

  const d = f.px(f.by({ square: 560, portrait: 680, story: 760, landscape: 880 }));
  const x = f.px(f.wide ? 40 : 36);
  const y = (f.tall ? a.bottom : f.height - f.px(f.wide ? 40 : 36)) - d;
  f.add("shape", "shade", x, y, d, d, { shape: "ellipse", fill: "#f6c531", shadow: true });
  f.add("avatar", "main", x, y, d, d, { fill: "#fff1c2", color: rust });

  const named = (c: Column) => row(f, name.size! * 1.2, 0, (top, h) => f.add("name", "main", c.x, top, c.w, h, { ...name }));
  /** The sound over the episode, at the right of the foot. */
  const footH = f.px(44 + 22) + f.lines(tag.size!, 1, 1);
  const foot = (right: number, bottom: number) => {
    f.add("visual", "main", right - f.px(200), bottom - footH, f.px(200), f.px(44), { visual: "bars", color: ink });
    label(f, "ep", "Ep. 00", right, bottom - f.lines(tag.size!, 1, 1), tag, 0.72);
  };

  if (f.wide) {
    const c = column(f.px(1000), a.right);
    stack(a.top, a.bottom - footH - f.px(30), [named(c), heading(f, c, title, 4, 6), space(0.6), captions(f, c, words, 3, 24), space()]);
    foot(a.right, a.bottom);
    return;
  }
  const c = column(f.px(f.by({ square: 300, portrait: 300, story: 280, landscape: 0 })), a.right);
  stack(a.top, y - f.px(24), [
    named(c),
    heading(f, c, title, 4, 6),
    space(0.6),
    captions(f, column(a.left, a.right), words, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 }), 24),
    space(),
  ]);
  foot(a.right, a.bottom);
});

/** The podcast templates in the order the picker shows them. */
export const PODCAST_TEMPLATES: TemplateChoice[] = [
  colorCollage,
  portraitBand,
  pastelPixel,
  signalYellow,
  scriptRed,
  giantType,
  retroPoster,
  sunnyPortrait,
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

/** The design a first visit opens on: Night Glass on every shape, so the clip looks finished before anything is
 *  picked and every part of it is there to change. */
export function firstDesign(): { layers: Record<Layout, Layer[]>; page: Page | null; theme?: number } {
  const layouts: Layout[] = ["square", "portrait", "story", "landscape"];
  const made = nightGlass.make("square");
  return { layers: Object.fromEntries(layouts.map((layout) => [layout, nightGlass.make(layout).layers])) as Record<Layout, Layer[]>, page: made.page, theme: made.theme };
}
