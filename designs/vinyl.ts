import type { Art } from "@drkxbt/audiogram";
import { area, avatarAt, captions, column, DM_SANS, EMBER, INTER, label, QUIET, SERIF, space, stack, template, tenth, type Block, type Column, type Frame, type Portrait, type Style } from "../template-kit.js";

const GROUND = "#0d0806";
const AMBER = "#f2a541";
const CREAM = "#f6e8d0";
const EMBER_LIGHT = "#b8561a";
const OXBLOOD = "#6e2310";
const PLATTER = "#0b0908";
const GROOVE = "#7a644e";
const LABEL = "#d98a2b";
const LABEL_INK = "#3a1d08";
const ARM = "#d9ccb7";

/** A circle as path data, centred on `cx`, `cy`. */
const circle = (cx: number, cy: number, r: number) => `M${tenth(cx - r)} ${tenth(cy)}a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(r * 2)} 0a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(-r * 2)} 0`;

/** A slice of a ring between radii `r0` and `r1`, from angle `a0` to `a1` in degrees clockwise from three o'clock. */
function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const at = (r: number, deg: number) => `${tenth(cx + r * Math.cos((deg * Math.PI) / 180))} ${tenth(cy + r * Math.sin((deg * Math.PI) / 180))}`;
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${at(r1, a0)}A${tenth(r1)} ${tenth(r1)} 0 ${large} 1 ${at(r1, a1)}L${at(r0, a1)}A${tenth(r0)} ${tenth(r0)} 0 ${large} 0 ${at(r0, a0)}z`;
}

/** The grooves of a record `r` in radius: fine rings in three strengths, with the smoother bands between tracks. */
function grooves(r: number, step: number, line: number): Art {
  const strengths = ["", "", ""];
  let i = 0;
  for (let rr = r * 0.4; rr < r * 0.965; rr += step, i++) strengths[i % 3] += circle(r, r, rr);
  const gaps = [0.52, 0.66, 0.81].map((share) => circle(r, r, r * share)).join("");
  return {
    w: tenth(r * 2),
    h: tenth(r * 2),
    paths: [
      { d: strengths[0], stroke: "currentColor", width: line, opacity: 0.55 },
      { d: strengths[1], stroke: "currentColor", width: line, opacity: 0.32 },
      { d: strengths[2], stroke: "currentColor", width: line, opacity: 0.18 },
      { d: gaps, stroke: "#000000", width: line * 3.5, opacity: 0.8 },
      { d: circle(r, r, r * 0.985), stroke: "currentColor", width: line * 1.6, opacity: 0.7 },
    ],
  };
}

/** The light a lamp leaves on vinyl: two soft wedges facing each other across the spindle, which stay put while the
 *  record turns under them, as a real reflection does. */
function sheen(r: number): Art {
  const wedge = (mid: number, spread: number) => [mid, mid + 180].map((m) => sector(r, r, r * 0.38, r * 0.97, m - spread, m + spread)).join("");
  return {
    w: tenth(r * 2),
    h: tenth(r * 2),
    paths: [
      { d: wedge(-58, 22), fill: "currentColor", opacity: 0.05 },
      { d: wedge(-58, 11), fill: "currentColor", opacity: 0.07 },
      { d: wedge(-58, 4), fill: "currentColor", opacity: 0.1 },
    ],
  };
}

/** What is printed on the label, off centre so the turn shows: two fine rings, a run of type and a smaller one, and
 *  the spindle hole. */
function print(r: number, line: number): Art {
  return {
    w: tenth(r * 2),
    h: tenth(r * 2),
    paths: [
      { d: circle(r, r, r * 0.92) + circle(r, r, r * 0.6), stroke: "currentColor", width: line, opacity: 0.55 },
      { d: sector(r, r, r * 0.68, r * 0.8, 200, 330), fill: "currentColor", opacity: 0.6 },
      { d: sector(r, r, r * 0.7, r * 0.77, 30, 78), fill: "currentColor", opacity: 0.4 },
      { d: sector(r, r, r * 0.3, r * 0.42, 95, 135), fill: "currentColor", opacity: 0.35 },
      { d: circle(r, r, r * 0.11), fill: GROUND },
    ],
  };
}

/** A tone arm resting on the outer grooves: counterweight, tube and headshell, drawn in a box whose top left is at
 *  `x`, `y` in frame pixels. Points are given in frame pixels and moved into the box. */
function arm(x: number, y: number, w: number, h: number, pivot: [number, number], stylus: [number, number], r: number, tube: number): Art {
  const [px, py] = [pivot[0] - x, pivot[1] - y];
  const [sx, sy] = [stylus[0] - x, stylus[1] - y];
  const length = Math.hypot(sx - px, sy - py);
  const [ux, uy] = [(sx - px) / length, (sy - py) / length];
  // The tube kinks just before the headshell, the way an S-arm offsets its cartridge toward the spindle.
  const kx = px + ux * length * 0.78 - uy * r * 0.06;
  const ky = py + uy * length * 0.78 + ux * r * 0.06;
  const [hx, hy] = [(sx - kx) / Math.hypot(sx - kx, sy - ky), (sy - ky) / Math.hypot(sx - kx, sy - ky)];
  const p = (a: number, b: number) => `${tenth(a)} ${tenth(b)}`;
  return {
    w: tenth(w),
    h: tenth(h),
    paths: [
      { d: `M${p(px - ux * r * 0.07, py - uy * r * 0.07)}L${p(px - ux * r * 0.3, py - uy * r * 0.3)}`, stroke: "currentColor", width: tube * 3.6 },
      { d: `M${p(px, py)}L${p(kx, ky)}L${p(sx - hx * r * 0.08, sy - hy * r * 0.08)}`, stroke: "currentColor", width: tube },
      { d: `M${p(sx - hx * r * 0.2, sy - hy * r * 0.2)}L${p(sx, sy)}`, stroke: "currentColor", width: tube * 2.6 },
    ],
  };
}

/** A record `r` in radius turning on `cx`, `cy`: the sound as bars round its label, the tone arm on its grooves. */
function record(f: Frame, cx: number, cy: number, r: number): void {
  const d = r * 2;
  const into = { enter: "zoom", from: 0 } as const;
  f.add("shape", "platter", cx - r, cy - r, d, d, { shape: "ellipse", fill: PLATTER, stroke: "#2c2118", strokeWidth: 2, shadow: true, ...into });
  f.add("graphic", "grooves", cx - r, cy - r, d, d, { art: grooves(r, f.px(4.5), f.px(1.2)), color: GROOVE, ...into });
  f.add("graphic", "sheen", cx - r, cy - r, d, d, { art: sheen(r), color: CREAM, ...into, loop: "shimmer" });
  // The bars rise from just outside the label and reach past the rim, so the record seems to give off the sound.
  const reach = r * 1.24;
  f.add("visual", "main", cx - reach, cy - reach, reach * 2, reach * 2, { visual: "radial", color: AMBER, opacity: 0.92, enter: "fade", from: 0.5 });
  const lr = r * 0.36;
  f.add("shape", "label", cx - lr, cy - lr, lr * 2, lr * 2, { shape: "ellipse", fill: LABEL, ...into });
  f.add("graphic", "print", cx - lr, cy - lr, lr * 2, lr * 2, { art: print(lr, f.px(1.5)), color: LABEL_INK, ...into, loop: "rotate" });

  const pivot: [number, number] = [cx + r * 1.02, cy - r * 0.9];
  const angle = (22 * Math.PI) / 180;
  const stylus: [number, number] = [cx + r * 0.8 * Math.cos(angle), cy + r * 0.8 * Math.sin(angle)];
  const base = r * 0.17;
  f.add("shape", "base", pivot[0] - base, pivot[1] - base, base * 2, base * 2, { shape: "ellipse", fill: "#1c1511", stroke: "#5a4632", strokeWidth: 1.5, enter: "fade", from: 0.55 });
  const left = Math.min(stylus[0], pivot[0] - r * 0.36) - f.px(20);
  const top = pivot[1] - r * 0.36;
  const right = pivot[0] + r * 0.36;
  const bottom = stylus[1] + f.px(20);
  f.add("graphic", "arm", left, top, right - left, bottom - top, { art: arm(left, top, right - left, bottom - top, pivot, stylus, r, f.px(6)), color: ARM, enter: "fade", from: 0.7 });
  const knob = r * 0.11;
  f.add("solid", "pivot", pivot[0] - knob, pivot[1] - knob, knob * 2, knob * 2, { solid: "sphere", fill: "#a8957a", shadow: false, enter: "pop", from: 0.6 });
}

/** Late-night listening: a record turning in amber light with the sound fanning round its label, the title in a fine
 *  serif, the captions large in cream, and the time left on the side at the foot. */
export const vinyl = template("vinyl", "Vinyl", { color: "#1d120b", to: "#0a0605", angle: 160 }, EMBER, (f) => {
  f.add("ambient", "glow", 0, 0, f.width, f.height, { ambient: "aurora", fill: GROUND, color: EMBER_LIGHT, highlight: OXBLOOD, pace: 0.6, react: true });

  const kicker: Style = { font: INTER, size: 26, weight: 600, color: AMBER, uppercase: true, letterSpacing: 220 };
  const title: Style = { font: SERIF, size: f.by({ square: 48, portrait: 48, story: 54, landscape: 56 }), weight: 400, color: CREAM, lineHeight: 1.08 };
  const words: Style = { font: DM_SANS, size: f.by({ square: 64, portrait: 68, story: 74, landscape: 66 }), weight: 600, color: CREAM, highlight: AMBER, lineHeight: 1.26, enter: "fade", from: 0.3 };
  const name: Style = { font: DM_SANS, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 32 }), weight: 600, color: CREAM };
  const handle: Style = { font: DM_SANS, size: f.by({ square: 26, portrait: 26, story: 29, landscape: 27 }), weight: 400, color: CREAM, opacity: QUIET };
  const time: Style = { font: SERIF, size: f.by({ square: 52, portrait: 54, story: 58, landscape: 54 }), weight: 400, color: AMBER, clock: "remaining" };
  const portrait: Portrait = { fill: "#3a2516", ink: CREAM, rim: AMBER };
  const a = area(f);
  const c = column(a.left, a.right);

  /** The side and track over the title, which has room for `count` lines. */
  const heading = (c: Column, count: number, gap: number): Block => {
    const kickH = f.lines(kicker.size!, 1, 1);
    const titleH = f.lines(title.size!, count, title.lineHeight) + f.px(2);
    const between = f.px(22);
    return {
      h: kickH + between + titleH,
      gap: f.px(gap),
      draw: (y) => {
        f.add("shape", "tick", c.x, y + kickH / 2 - f.px(1), f.px(36), f.px(2), { shape: "rect", fill: AMBER, enter: "wipe", direction: "right", from: 0.2 });
        label(f, "kicker", "A1  ·  Now playing", c.x + f.px(52), y, { ...kicker, enter: "spread", from: 0.25, loop: "shimmer" }, 0.6);
        f.add("title", "main", c.x, y + kickH + between, c.w, titleH, { align: "left", ...title, enter: "clarify", from: 0.4 });
      },
    };
  };

  /** A hairline, then the speaker on the left and the time left on the side on the right. */
  const foot = (c: Column, d: number, gap: number): Block => {
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const h = Math.max(f.px(d), nameH + handleH);
    const above = f.px(26);
    return {
      h: h + above,
      gap: f.px(gap),
      draw: (y) => {
        f.add("shape", "rule", c.x, y, c.w, f.px(6), { shape: "line", fill: AMBER, strokeWidth: 1.5, opacity: 0.4, enter: "wipe", direction: "right", from: 0.6 });
        const by = y + above;
        avatarAt(f, c.x + f.px(d) / 2, by + h / 2, d, portrait, { enter: "pop", from: 0.8 });
        const tx = c.x + f.px(d + 22);
        const top = by + (h - nameH - handleH) / 2;
        const timeW = f.px(time.size! * 3);
        f.add("name", "main", tx, top, c.x + c.w - timeW - tx, nameH, { align: "left", ...name, enter: "rise", from: 0.9 });
        f.add("handle", "main", tx, top + nameH, c.x + c.w - timeW - tx, handleH, { align: "left", ...handle, enter: "rise", from: 1 });
        const timeH = f.lines(time.size!, 1, 1.2);
        const sideH = f.lines(kicker.size!, 1, 1);
        const block = sideH + f.px(6) + timeH;
        const ty = by + (h - block) / 2;
        label(f, "side", "Side A", c.x + c.w, ty, { ...kicker, align: "right", opacity: QUIET, enter: "fade", from: 1 }, 0.6);
        f.add("time", "main", c.x + c.w - timeW, ty + sideH + f.px(6), timeW, timeH, { ...time, align: "right", enter: "fade", from: 1.05 });
      },
    };
  };

  const d = f.by({ square: 80, portrait: 86, story: 96, landscape: 88 });
  if (f.wide) {
    // The record on the left the full height; everything to read in a column on the right.
    const reach = (a.h / 2) * 0.98;
    const r = reach / 1.24;
    const cx = a.left + reach;
    record(f, cx, f.height / 2, r);
    const right = column(a.left + reach * 2 + f.px(90), a.right);
    stack(a.top, a.bottom, [heading(right, 3, 0), space(1), captions(f, right, words, 4), space(1), foot(right, d, 0)]);
    return;
  }
  if (f.tall) {
    // The record sits high, into the band the apps cover at the top, since it carries no words.
    const reach = f.px(390);
    const r = reach / 1.24;
    const cy = f.height * 0.05 + reach;
    record(f, a.right - reach - f.px(30), cy, r);
    stack(cy + reach + f.px(40), a.bottom, [heading(c, 2, 0), space(1), captions(f, c, words, 4), space(1), foot(c, d, 0)]);
    return;
  }
  // Square and portrait: the record at the top right, the title beside it, the captions across the foot.
  const reach = f.px(f.by({ square: 238, portrait: 250, story: 0, landscape: 0 }));
  const r = reach / 1.24;
  const cx = a.right - reach;
  const cy = a.top + reach;
  record(f, cx, cy, r);
  const beside = column(a.left, cx - reach - f.px(36));
  stack(a.top + f.px(6), cy + reach, [heading(beside, f.by({ square: 4, portrait: 5, story: 0, landscape: 0 }), 0), space(1)]);
  stack(cy + reach + f.px(30), a.bottom, [space(1), captions(f, c, words, f.by({ square: 3, portrait: 4, story: 0, landscape: 0 })), space(1), foot(c, d, 0)]);
});
