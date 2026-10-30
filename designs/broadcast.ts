import type { Art } from "@drkxbt/audiogram";
import { ARCHIVO, area, avatarAt, backdrop, captions, column, glass, heading, INK, INTER, label, MONO, QUIET, round, row, space, stack, template, tenth, WHITE, type Block, type Column, type Glass, type Portrait, type Style } from "../template-kit.js";

const GROUND = "#061032";
const RED = "#d71e28";
const NAVY_LIGHT = "#7090ff";
const PAPER_WHITE = "#f3f4f7";
const NAME_INK = "#0a0d16";
const CONDENSED = "Oswald Variable";

// Smoked glass under the handle and the sound: dark enough that the rays never wash them out.
const STRIP: Glass = { tint: "#080c18", strength: 0.7, frost: 28, corner: 0, edge: 1 };

/** A broadcast ruler: a baseline with a tick every `step` and a taller one every fifth, like the timecode strip of a
 *  news desk's graphics. */
function ticks(w: number, h: number, step: number, line: number): Art {
  let major = "";
  let minor = "";
  const count = Math.floor((w - line) / step);
  for (let i = 0; i <= count; i++) {
    const x = tenth(line / 2 + i * step);
    if (i % 5 === 0) major += `M${x} 0v${tenth(h)}`;
    else minor += `M${x} ${tenth(h * 0.55)}v${tenth(h * 0.45)}`;
  }
  return {
    w: tenth(w),
    h: tenth(h),
    paths: [
      { d: `M0 ${tenth(h - line / 2)}h${tenth(w)}`, stroke: "currentColor", width: line },
      { d: major, stroke: "currentColor", width: line },
      { d: minor, stroke: "currentColor", width: line, opacity: 0.45 },
    ],
  };
}

/** A news desk on air: a city at night out of focus behind light raking down from the rig, a red live chip that beats,
 *  a ruler that wipes across under the headline, the captions large and bold, and a lower third that names the speaker
 *  on white over their handle and the sound on smoked glass. */
export const broadcast = template("broadcast", "Broadcast", { color: "#0b1122", to: "#05070d", angle: 180 }, INK, (f) => {
  // The skyline is only a hint of place: blurred, toned blue and graded well down, then mostly covered by the rays' own
  // navy ground, so its lights show through like a studio backdrop out of focus.
  backdrop(f, "4b8f01e2", { filter: "slate", adjust: { brightness: 0.58, contrast: 1.25, blur: 6 }, crop: { x: f.by({ square: 0.2, portrait: 0.3, story: 0.4, landscape: 0 }), y: 0.2, zoom: 1.1 }, loop: "slowZoom" });
  f.add("ambient", "rays", 0, 0, f.width, f.height, { ambient: "rays", fill: GROUND, color: RED, highlight: NAVY_LIGHT, pace: 0.8, react: true, opacity: 0.62 });

  const chip: Style = { font: CONDENSED, size: f.by({ square: 28, portrait: 28, story: 30, landscape: 28 }), weight: 600, color: WHITE, uppercase: true, letterSpacing: 120 };
  const show: Style = { font: CONDENSED, size: f.by({ square: 28, portrait: 28, story: 30, landscape: 28 }), weight: 500, color: WHITE, opacity: 0.86, uppercase: true, letterSpacing: 140 };
  const time: Style = { font: MONO, size: f.by({ square: 30, portrait: 30, story: 32, landscape: 30 }), weight: 400, color: WHITE, clock: "elapsed" };
  const title: Style = { font: ARCHIVO, size: f.by({ square: 38, portrait: 40, story: 44, landscape: 42 }), weight: 700, color: WHITE, opacity: 0.94, lineHeight: 1.15, enter: "block", from: 0.55 };
  const words: Style = { font: ARCHIVO, size: f.by({ square: 72, portrait: 78, story: 84, landscape: 80 }), weight: 800, color: WHITE, highlight: RED, lineHeight: 1.18, shadow: true, enter: "rise", from: 0.2 };
  const name: Style = { font: ARCHIVO, size: f.by({ square: 34, portrait: 36, story: 40, landscape: 36 }), weight: 800, color: NAME_INK, uppercase: true, letterSpacing: 30 };
  const handle: Style = { font: INTER, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 27 }), weight: 500, color: WHITE, opacity: QUIET };
  const portrait: Portrait = { fill: "#1b2340", ink: WHITE, rim: WHITE };
  const a = area(f);
  const c = column(a.left, a.right);

  /** The live chip with its beating light, the show's name, and the time on air at the far right. */
  const topBar = (c: Column): Block => row(f, f.by({ square: 52, portrait: 54, story: 58, landscape: 54 }), 0, (y, h) => {
    const chipW = f.px(chip.size! * 4.4);
    f.add("shape", "chip", c.x, y, chipW, h, { shape: "rect", radius: round(f.px(5) / h), fill: RED, enter: "wipe", direction: "right", from: 0.1 });
    const dot = f.px(12);
    f.add("shape", "dot", c.x + f.px(18), y + (h - dot) / 2, dot, dot, { shape: "ellipse", fill: WHITE, enter: "pop", from: 0.3, loop: "heartbeat" });
    label(f, "live", "Live", c.x + f.px(40), y + (h - f.px(chip.size!)) / 2, { ...chip, enter: "fade", from: 0.3 }, 0.5);
    label(f, "show", "Your show  ·  Ep. 00", c.x + chipW + f.px(24), y + (h - f.px(show.size!)) / 2, { ...show, enter: "shift", from: 0.35 }, 0.46);
    const clockW = f.px(time.size! * 3.4);
    f.add("time", "main", c.x + c.w - clockW, y, clockW, h, { ...time, align: "right", enter: "flicker", from: 0.45 });
    // Set by the width of a clock under ten minutes, so it reads as one with the figures.
    const tag: Style = { ...show, size: chip.size, opacity: QUIET, letterSpacing: 160, enter: "fade", from: 0.5 };
    label(f, "elapsed", "On air", c.x + c.w - f.px(time.size! * 2.6 + 22), y + (h - f.px(tag.size!)) / 2, { ...tag, align: "right" }, 0.46);
  });

  /** The ruler under the top bar, wiping across, with a red run where the show is. */
  const ruler = (c: Column, gap: number): Block => row(f, 18, gap, (y, h) => {
    f.add("graphic", "ruler", c.x, y, c.w, h, { art: ticks(c.w, h, f.px(12), f.px(1.5)), color: WHITE, opacity: 0.55, enter: "wipe", direction: "right", from: 0.2, speed: 0.6 });
    f.add("shape", "run", c.x, y + h - f.px(4), c.w * 0.22, f.px(4), { shape: "rect", fill: RED, enter: "wipe", direction: "right", from: 0.4, speed: 0.7 });
  });

  /** The speaker's photo in a white ring, and beside it two tiers: their name on white, their handle and the sound on
   *  smoked glass, a red edge down the left of both. Each part wipes in after the one before. */
  const lowerThird = (c: Column, gap: number): Block => {
    const nameH = f.lines(name.size!, 1, 1) + f.px(f.by({ square: 30, portrait: 32, story: 36, landscape: 32 }));
    const stripH = f.lines(handle.size!, 1, 1) + f.px(f.by({ square: 28, portrait: 30, story: 34, landscape: 30 }));
    const h = nameH + stripH;
    const d = h / f.unit;
    return {
      h,
      gap: f.px(gap),
      draw: (y) => {
        avatarAt(f, c.x + h / 2, y + h / 2, d - 10, portrait, { enter: "pop", from: 0.8 });
        const x = c.x + h + f.px(18);
        const w = c.x + c.w - x;
        const edge = f.px(10);
        f.add("shape", "accent", x, y, edge, h, { shape: "rect", fill: RED, enter: "wipe", direction: "down", from: 0.6 });
        f.add("shape", "plate", x + edge, y, w - edge, nameH, { shape: "rect", fill: PAPER_WHITE, shadow: true, enter: "wipe", direction: "right", from: 0.65, speed: 0.8 });
        const tx = x + edge + f.px(24);
        const barsW = f.px(f.wide ? 240 : 190);
        f.add("name", "main", tx, y, c.x + c.w - tx - f.px(20), nameH, { align: "left", ...name, enter: "slide", direction: "right", from: 0.85 });
        glass(f, "strip", x + edge, y + nameH, w - edge, stripH, STRIP, { enter: "wipe", direction: "right", from: 0.75, speed: 0.8 });
        f.add("handle", "main", tx, y + nameH, c.x + c.w - tx - barsW - f.px(40), stripH, { align: "left", ...handle, enter: "slide", direction: "right", from: 0.95 });
        f.add("visual", "main", c.x + c.w - barsW - f.px(22), y + nameH + stripH * 0.2, barsW, stripH * 0.6, { visual: "bars", color: WHITE, enter: "fade", from: 1.05 });
      },
    };
  };

  if (f.wide) {
    stack(a.top, a.bottom, [
      topBar(c),
      ruler(c, 22),
      heading(f, column(a.left, a.left + f.px(1240)), title, 2, 30),
      space(1),
      captions(f, column(a.left, a.left + f.px(1460)), words, 3),
      space(0.7),
      lowerThird(column(a.left, a.left + f.px(1100)), 0),
    ]);
    return;
  }
  stack(a.top, a.bottom, [
    topBar(c),
    ruler(c, f.by({ square: 20, portrait: 24, story: 28, landscape: 0 })),
    heading(f, c, title, 2, f.by({ square: 26, portrait: 30, story: 36, landscape: 0 })),
    space(1),
    captions(f, c, words, f.by({ square: 3, portrait: 4, story: 5, landscape: 0 })),
    space(0.7),
    lowerThird(c, 0),
  ]);
});
