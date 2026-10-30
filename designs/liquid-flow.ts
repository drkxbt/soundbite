import { area, tenth, captions, column, heading, INK, label, MONO, OUTFIT, GROTESK, row, space, stack, template, WHITE, type Block, type Column, type Frame, type Style } from "../template-kit.js";
import type { Art } from "@drkxbt/audiogram";

const MINT = "#3cf2c3";
const CYAN = "#2bc9ff";
const VIOLET = "#7b5cff";
// The flow's ground: a violet so deep the mint and cyan lights drifting over it read as the colour, not the page.
const DEEP = "#0d0a26";

/** A colour part way from `a` to `b`, as #rrggbb. */
function blend(a: string, b: string, share: number): string {
  const channel = (hex: string, shift: number) => (parseInt(hex.slice(1), 16) >> shift) & 255;
  return `#${[16, 8, 0].map((shift) => Math.round(channel(a, shift) + (channel(b, shift) - channel(a, shift)) * share).toString(16).padStart(2, "0")).join("")}`;
}

/** A smooth line through points, each stretch a curve whose ends lean toward the points either side. */
function smooth(points: Array<[number, number]>): string {
  let d = `M${tenth(points[0][0])} ${tenth(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    d += `C${tenth(x1 + (x2 - x0) / 6)} ${tenth(y1 + (y2 - y0) / 6)} ${tenth(x2 - (x3 - x1) / 6)} ${tenth(y2 - (y3 - y1) / 6)} ${tenth(x2)} ${tenth(y2)}`;
  }
  return d;
}

/** A ribbon of fine lines across a `w` by `h` box: they follow one slow wave, and the space between them swells and
 *  pinches through nothing, so the ribbon seems to twist as liquid does. Mint at one edge through cyan to violet at the
 *  other, brightest along its middle. */
function ribbon(w: number, h: number, count: number, width: number): Art {
  const steps = 28;
  const paths: Art["paths"] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const points: Array<[number, number]> = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const centre = 0.5 + 0.27 * Math.sin(u * Math.PI * 1.7 + 0.5);
      const spread = 0.26 * Math.sin(u * Math.PI * 2.3 + 1.2);
      points.push([u * w, (centre + (t - 0.5) * spread) * h]);
    }
    const stroke = t < 0.5 ? blend(MINT, CYAN, t * 2) : blend(CYAN, VIOLET, (t - 0.5) * 2);
    paths.push({ d: smooth(points), stroke, width, opacity: tenth(0.25 + 0.55 * (1 - Math.abs(t - 0.5) * 2)) });
  }
  return { w: tenth(w), h: tenth(h), paths };
}

/** The ribbon laid across the lower half of the frame, drawn in from the left and then drifting up and down slowly. */
function flowLines(f: Frame): void {
  const top = f.height * f.by({ square: 0.5, portrait: 0.52, story: 0.5, landscape: 0.42 });
  const bottom = f.height * f.by({ square: 0.92, portrait: 0.9, story: 0.8, landscape: 0.94 });
  const h = bottom - top;
  f.add("graphic", "ribbon", 0, top, f.width, h, { art: ribbon(f.width, h, 22, f.px(1.6)), color: MINT, opacity: 0.9, enter: "wipe", speed: 0.4, from: 0.1, loop: "float" });
}

/** The show's sample name turned up the right margin, the way a printed page runs its folio. */
function folio(f: Frame, a: { right: number; top: number; bottom: number }): void {
  const text = "Your show  /  Ep. 00";
  const size = 26;
  const w = f.px(size * text.length * (0.62 + 0.24));
  const h = f.lines(size, 1, 1);
  const cx = a.right + f.pad / 2;
  const cy = a.top + (a.bottom - a.top) * 0.5;
  f.add("text", "folio", cx - w / 2, cy - h / 2, w, h, { text, font: MONO, size, weight: 400, color: WHITE, opacity: 0.78, uppercase: true, letterSpacing: 240, align: "center", lineHeight: 1, rotation: 90, enter: "fade", from: 0.8 });
}

/** A pulsing live dot, a small label and the time played across the top, over a hairline. */
function topline(f: Frame, c: Column): Block {
  const tag: Style = { font: MONO, size: 26, weight: 700, color: MINT, uppercase: true, letterSpacing: 140 };
  return row(f, 40, 0, (y, h) => {
    const dot = f.px(14);
    f.add("shape", "dot", c.x, y + (h - dot) / 2 - f.px(6), dot, dot, { shape: "ellipse", fill: MINT, enter: "pop", from: 0.1, loop: "pulse" });
    label(f, "tag", "Now playing", c.x + f.px(30), y + (h - f.lines(26, 1, 1)) / 2 - f.px(6), { ...tag, enter: "glide", from: 0.15 });
    f.add("time", "main", c.x + c.w - f.px(200), y - f.px(6), f.px(200), h, { clock: "elapsed", font: MONO, size: 26, weight: 400, color: WHITE, opacity: 0.8, align: "right", enter: "fade", from: 0.3 });
    f.add("shape", "line-top", c.x, y + h, c.w, f.px(6), { shape: "line", fill: WHITE, strokeWidth: 1.5, opacity: 0.3, enter: "wipe", from: 0.2 });
  });
}

/** The speaker's name and handle at the left, their photo at the right inside the pulse, whose rings ripple out of it
 *  with the voice: the box is held to the margin, so the rings start just past the photo's edge. */
function speaker(f: Frame, c: Column, gap: number): Block {
  const d = 84;
  return row(f, d, gap, (y, h) => {
    f.add("shape", "line-foot", c.x, y - f.px(30), c.w, f.px(6), { shape: "line", fill: WHITE, strokeWidth: 1.5, opacity: 0.22, enter: "wipe", from: 0.45 });
    const side = f.px(d);
    const cx = c.x + c.w - side / 2;
    const cy = y + h / 2;
    const ripple = side + f.pad * 1.8;
    f.add("visual", "main", cx - ripple / 2, cy - ripple / 2, ripple, ripple, { visual: "pulse", color: MINT, enter: "fade", from: 0.6 });
    f.add("avatar", "main", cx - side / 2, cy - side / 2, side, side, { fill: "#d9fff3", color: "#0a3a2e", enter: "iris", from: 0.5 });
    const nameH = f.lines(34, 1, 1.25);
    const handleH = f.lines(26, 1, 1.3);
    const top = cy - (nameH + handleH) / 2;
    const w = c.w - ripple;
    f.add("name", "main", c.x, top, w, nameH, { align: "left", font: OUTFIT, size: 34, weight: 600, color: WHITE, enter: "rise", from: 0.6 });
    f.add("handle", "main", c.x, top + nameH, w, handleH, { align: "left", font: MONO, size: 26, weight: 400, color: MINT, opacity: 0.9, enter: "rise", from: 0.72 });
  });
}

/** A drifting mint and cyan flow on deep violet with a twisting ribbon of fine lines across it: the title small and
 *  spaced at the top, the captions huge and rising a word at a time, the speaker at the foot inside a pulse that
 *  ripples with the voice. */
export const liquidFlow = template("liquid-flow", "Liquid Flow", { color: DEEP, to: "#061a20", angle: 160 }, INK, (f) => {
  f.add("ambient", "flow", 0, 0, f.width, f.height, { ambient: "flow", fill: DEEP, color: MINT, highlight: CYAN, pace: 1.8, react: true });
  flowLines(f);
  const a = area(f);
  folio(f, a);
  const c = column(a.left, a.right);
  const title: Style = { font: GROTESK, size: f.by({ square: 28, portrait: 30, story: 32, landscape: 30 }), weight: 500, color: WHITE, uppercase: true, letterSpacing: 160, lineHeight: 1.4, enter: "merge", from: 0.35 };
  const words: Style = { font: OUTFIT, size: f.by({ square: 88, portrait: 100, story: 108, landscape: 96 }), weight: 700, color: WHITE, highlight: MINT, lineHeight: 1.08, enter: "ascend" };
  const titleColumn = f.wide ? column(a.left, a.left + f.px(1100)) : c;
  const wordsColumn = f.wide ? column(a.left, a.left + f.px(1450)) : c;
  stack(a.top, a.bottom - f.pad * 0.1, [
    topline(f, c),
    heading(f, titleColumn, title, f.by({ square: 2, portrait: 3, story: 3, landscape: 2 }), f.by({ square: 28, portrait: 36, story: 44, landscape: 32 })),
    space(1),
    captions(f, wordsColumn, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 3 }), 24, 4),
    space(1),
    speaker(f, c, f.by({ square: 56, portrait: 64, story: 72, landscape: 56 })),
  ]);
});
