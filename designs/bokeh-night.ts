import { area, backdrop, captions, card, column, DM_SANS, glass, header, INK, label, measure, MONO, QUIET, row, rule, stats, template, WHITE, type Blocks, type Column, type Frame, type Glass, type Portrait, type Stat, type StatLook, type Style } from "../template-kit.js";

const AMBER = "#ffb35c";
const ROSE = "#ff6fae";
// Smoked nearly black, so the captions still to come, drawn at half strength, read over the brightest towers.
const SMOKE: Glass = { tint: "#06060c", strength: 0.5, frost: 36, corner: 44, edge: 1.2 };
const CHIP: Glass = { tint: "#0a0912", strength: 0.46, frost: 28, corner: 999, edge: 1.2 };

// The clip's own time played and left, which are always true.
const TIMES: Stat[] = [
  { clock: "elapsed", glyph: "headphones", label: "Played" },
  { clock: "remaining", glyph: "clock", label: "Left" },
];

/** A small pill of smoked glass with a mark and a word in it, floating gently; returns how wide it came out. */
function badge(f: Frame, name: string, x: number, y: number, text: string, mark: (x: number, cy: number) => void, from: number): number {
  const size = 26;
  const h = f.px(58);
  const w = f.px(size * text.length * 0.66 + 34 + 30 + 26);
  const motion: Style = { enter: "pop", from, loop: "float" };
  glass(f, `badge-${name}`, x, y, w, h, CHIP, motion);
  mark(x + f.px(26), y + h / 2);
  label(f, `badge-${name}`, text, x + f.px(26 + 30), y + (h - f.lines(size, 1, 1)) / 2, { font: MONO, size, weight: 700, color: WHITE, uppercase: true, letterSpacing: 90, ...motion });
  return w;
}

/** A crescent and the words after dark, and the episode, floating over the city. */
function badges(f: Frame, left: number, right: number, y: number, together: boolean): void {
  const first = badge(f, "night", left, y, "After dark", (x, cy) => {
    const r = f.px(18);
    f.add("shape", "moon", x, cy - r / 2, r, r, { shape: "moon", fill: AMBER, enter: "pop", from: 0.2, loop: "float" });
  }, 0.2);
  const text = "Ep. 00";
  const w = f.px(26 * text.length * 0.66 + 34 + 30 + 26);
  badge(f, "episode", together ? left + first + f.px(16) : right - w, y, text, (x, cy) => {
    const r = f.px(12);
    f.add("shape", "spark", x + f.px(2), cy - r / 2, r, r, { shape: "ellipse", fill: ROSE, enter: "pop", from: 0.35, loop: "pulse" });
  }, 0.35);
}

/** Light caught along the card's top edge, near its corner, with a band of it crossing now and then. */
function glint(f: Frame, x: number, y: number): void {
  f.add("shape", "line-glint", x + f.px(52), y - f.px(3), f.px(200), f.px(6), { shape: "line", fill: AMBER, strokeWidth: 2, opacity: 0.9, enter: "wipe", from: 0.5, loop: "shimmer" });
}

/** The smoked card's insides: the speaker and title, the captions, the sound, and the time played and left. */
function inside(f: Frame, c: Column, roomy: boolean): Blocks {
  const title: Style = { font: DM_SANS, size: f.by({ square: 32, portrait: 36, story: 40, landscape: 36 }), weight: 600, color: WHITE, enter: "rise", from: 0.4 };
  const name: Style = { font: MONO, size: 26, weight: 400, color: AMBER, opacity: 0.92, uppercase: true, letterSpacing: 80, enter: "fade", from: 0.3 };
  const portrait: Portrait = { fill: "#ffe7c7", ink: "#4a2a10", rim: AMBER };
  const words: Style = { font: DM_SANS, size: f.by({ square: 54, portrait: 62, story: 70, landscape: 60 }), weight: 600, color: WHITE, highlight: AMBER, lineHeight: 1.25, enter: "rise", from: 0.5 };
  const figures: StatLook = { value: { font: DM_SANS, size: f.by({ square: 38, portrait: 42, story: 48, landscape: 44 }), weight: 500, color: WHITE, enter: "fade", from: 0.7 }, label: { font: DM_SANS, size: 26, weight: 400, enter: "fade", from: 0.8 }, ink: WHITE, dim: QUIET };
  const gap = f.by({ square: 22, portrait: 30, story: 40, landscape: 30 });
  return [
    header(f, c, title, name, f.by({ square: 76, portrait: 84, story: 96, landscape: 88 }), portrait),
    rule(f, c, "line-head", WHITE, 0.18, gap),
    captions(f, c, words, roomy ? 4 : 3, gap),
    row(f, 64, gap * 0.6, (y, h) => f.add("visual", "main", c.x, y, c.w, h, { visual: "bars", color: AMBER, enter: "fade", from: 0.6 })),
    rule(f, c, "line-foot", WHITE, 0.18, gap * 0.6),
    stats(f, column(c.x, c.x + c.w * 0.7), TIMES, figures, gap * 0.8),
  ];
}

/** A city at night out of focus and graded down, lights drifting up over it as bokeh, and a card of smoked glass
 *  holding the speaker, the captions, the sound and the time; two small chips float over the skyline. */
export const bokehNight = template("bokeh-night", "Bokeh Night", { color: "#1a1030", to: "#07060f", angle: 180 }, INK, (f) => {
  backdrop(f, "5d9b67b8", { adjust: { brightness: 1, saturation: 1.3, contrast: 1.1 }, crop: { x: f.by({ square: 0.1, portrait: 0.15, story: 0.15, landscape: 0 }), y: 0, zoom: 1.05 }, loop: "slowZoom" });
  // Over the photo at half strength: its dark ground grades the city down and its discs add light, as a lens would.
  f.add("ambient", "bokeh", 0, 0, f.width, f.height, { ambient: "bokeh", fill: "#0b0716", color: AMBER, highlight: ROSE, opacity: 0.55, pace: 1.2, react: true });
  const a = area(f);
  const inset = f.by({ square: 40, portrait: 48, story: 56, landscape: 52 });

  if (f.wide) {
    const x = f.width * 0.44;
    const w = a.right - x;
    const c = column(x + f.px(inset), a.right - f.px(inset));
    const blocks = inside(f, c, false);
    const y = a.top + (a.h - measure(blocks) - f.px(inset) * 2) / 2;
    card(f, "card", x, y, w, inset, SMOKE, blocks, { enter: "fade", speed: 0.6 });
    glint(f, x, y);
    badges(f, a.left, x - f.px(40), a.top, true);
    return;
  }
  const c = column(a.left + f.px(inset), a.right - f.px(inset));
  const blocks = inside(f, c, f.tall);
  const height = measure(blocks) + f.px(inset) * 2;
  card(f, "card", a.left, a.bottom - height, a.w, inset, SMOKE, blocks, { enter: "fade", speed: 0.6 });
  glint(f, a.left, a.bottom - height);
  badges(f, a.left, a.right, a.top, false);
});
