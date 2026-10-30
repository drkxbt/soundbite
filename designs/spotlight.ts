import { area, backdrop, BRICOLAGE, byline, captions, card, column, GROTESK, heading, INK, label, measure, QUIET, row, space, stack, template, WHITE, type Block, type Blocks, type Column, type Glass, type Portrait, type Style } from "../template-kit.js";

/* A studio microphone alone on a dark stage, a fan of warm light falling on it from above and swelling with the voice. The
   title lights up as a band of light crosses it; under the microphone a sheet of smoked glass blurs the stand away and
   holds the voice, traced as a glowing scope line, the captions large, and the speaker. */

const AMBER = "#ffc46b";
const CREAM = "#fff3e0";
const BEAM = "#ffd49a";

export const spotlight = template("spotlight", "Spotlight", { color: "#2a1d12", to: "#0a0705", angle: 180 }, INK, (f) => {
  // Zoomed a touch and set low, so the microphone's head stands on the centre line between the title and the glass,
  // under where the beam falls. The beam's own dark ground, laid over it at half strength, grades it down the rest of
  // the way, so the light has a dark room to fall into.
  backdrop(f, "d61ed0d3", {
    filter: "warm",
    adjust: { brightness: 0.85, contrast: 1.15, saturation: 0.8 },
    crop: f.by({ square: { x: 0.79, y: 1, zoom: 1.2 }, portrait: { x: 0.68, y: 1, zoom: 1.1 }, story: { x: 0.54, y: 1, zoom: 1.08 }, landscape: { x: 0, y: 0.4, zoom: 1.15 } }),
    loop: "slowZoom",
  });
  f.add("ambient", "beam", 0, 0, f.width, f.height, { ambient: "rays", fill: "#0b0704", color: BEAM, highlight: CREAM, react: true, pace: 0.8, opacity: 0.5 });

  const a = area(f);
  const tagSize = 26;
  const tag: Style = { font: GROTESK, size: tagSize, weight: 500, color: CREAM, opacity: 0.9, uppercase: true, letterSpacing: 220, enter: "fade", from: 0.1 };
  const title: Style = { font: BRICOLAGE, size: f.by({ square: 50, portrait: 54, story: 54, landscape: 54 }), weight: 700, color: CREAM, letterSpacing: -10, lineHeight: 1.08, enter: "shine", from: 0.15, speed: 0.8 };
  const words: Style = { font: BRICOLAGE, size: f.by({ square: 50, portrait: 56, story: 62, landscape: 56 }), weight: 600, color: WHITE, highlight: AMBER, lineHeight: 1.22, enter: "rise", from: 0.5 };
  const name: Style = { font: BRICOLAGE, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 30 }), weight: 600, color: WHITE, enter: "rise", from: 0.8 };
  const handle: Style = { font: BRICOLAGE, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: CREAM, opacity: QUIET + 0.07, enter: "rise", from: 0.9 };
  const portrait: Portrait = { fill: AMBER, ink: "#3a2306", rim: AMBER };
  const left: Style = { font: GROTESK, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 30 }), weight: 500, color: AMBER, clock: "remaining", align: "right", enter: "fade", from: 1 };
  // Smoked dark enough that the words still to come read on it, and frosted enough to turn the stand into soft light.
  const smoke: Glass = { tint: "#0d0805", strength: 0.5, frost: 22, corner: 30, edge: 1.2 };
  const inset = f.by({ square: 34, portrait: 40, story: 44, landscape: 40 });

  /** A small warm light that pulses, as a lamp on stage does, the show and episode beside it, and a hairline drawn on
   *  from them to the column's edge. */
  const marker = (c: Column, gap: number): Block =>
    row(f, tagSize, gap, (y, h) => {
      const dot = f.px(14);
      const show = "Your show · Ep. 00";
      f.add("shape", "lamp", c.x, y + (h - dot) / 2, dot, dot, { shape: "ellipse", fill: AMBER, loop: "pulse", enter: "pop", from: 0.1 });
      label(f, "show", show, c.x + dot + f.px(16), y, tag, 0.56);
      // From where the words end at about the widest Space Grotesk sets them, so the line never runs into them.
      const x = c.x + dot + f.px(16) + f.px(tagSize * show.length * (0.56 + 0.22)) + f.px(28);
      f.add("shape", "hairline", x, y + h / 2 - f.px(4), c.x + c.w - x, f.px(8), { shape: "line", fill: AMBER, strokeWidth: 1.5, opacity: 0.6, enter: "wipe", direction: "right", from: 0.4 });
    });

  /** The voice as one glowing line across the column, as an oscilloscope draws it. */
  const scope = (c: Column, h: number, gap: number): Block =>
    row(f, h, gap, (y, height) => f.add("visual", "main", c.x, y, c.w, height, { visual: "scope", color: AMBER, enter: "unfold", from: 0.6 }));

  /** The speaker's photo, name and handle, with the time still to play at the far end of the row. */
  const speaker = (c: Column, d: number, gap: number): Block =>
    byline(f, c, d, portrait, name, handle, gap, (y, h) => {
      const w = f.px(150);
      const clockH = f.lines(left.size!, 1, 1.2);
      f.add("time", "left", c.x + c.w - w, y + (h - clockH) / 2, w, clockH, left);
    });

  /** The glass sheet standing on the foot of the column `c`, holding the sound, the captions and the speaker. */
  const sheet = (c: Column, blocks: (inner: Column) => Blocks): void => {
    const inner = column(c.x + f.px(inset), c.x + c.w - f.px(inset));
    const list = blocks(inner);
    const h = measure(list) + f.px(inset) * 2;
    card(f, "sheet", c.x, a.bottom - h, c.w, inset, smoke, list, { stroke: CREAM, enter: "rise", from: 0.25 });
  };

  // The microphone stands right of centre on a wide frame, so the words take the darker left of the stage.
  const c = f.wide ? column(a.left, f.px(1000)) : column(a.left, a.right);
  stack(a.top, a.bottom, [marker(c, 0), heading(f, c, title, 2, f.by({ square: 22, portrait: 26, story: 32, landscape: 26 })), space()]);
  sheet(c, (inner) => [
    scope(inner, f.by({ square: 70, portrait: 100, story: 120, landscape: 90 }), 0),
    captions(f, inner, words, f.by({ square: 2, portrait: 3, story: 3, landscape: 3 }), 4),
    speaker(inner, f.by({ square: 80, portrait: 92, story: 104, landscape: 88 }), f.by({ square: 20, portrait: 28, story: 36, landscape: 26 })),
  ]);
});
