import { area, avatarAt, bars, captions, column, GROTESK, heading, INK, INTER, label, OUTFIT, QUIET, space, stack, template, WHITE, glass, type Block, type Column, type Frame, type Glass, type Portrait, type Style } from "../template-kit.js";

const TEAL = "#3ef2c9";
const MINT = "#9dffe6";
const VIOLET = "#7c4dff";
const GROUND = "#060d16";

// Tinted dark and kept thin, so the aurora and the orbs behind it read through as soft colour, not as a grey slab.
const PANE: Glass = { tint: "#0a1022", strength: 0.36, frost: 30, corner: 48, edge: 1.2 };

/**
 * The default design: an aurora in teal and violet that swells with the voice, two glossy orbs drifting behind one big
 * pane of frosted glass, and on the glass the speaker, a pulsing LIVE pill, the title, the captions and a player row
 * where a ring of dots runs round the share played.
 */
export const auroraGlass = template("aurora-glass", "Aurora Glass", { color: "#07131a", to: "#100b22", angle: 160 }, INK, (f) => {
  const a = area(f);
  const words: Style = { font: INTER, size: f.by({ square: 64, portrait: 74, story: 84, landscape: 72 }), weight: 700, color: WHITE, highlight: TEAL, lineHeight: 1.24, letterSpacing: -12 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 32, portrait: 36, story: 40, landscape: 38 }), weight: 500, color: WHITE, opacity: 0.9, lineHeight: 1.22, enter: "ascend", from: 0.3 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 32 }), weight: 600, color: WHITE, enter: "shift", direction: "right", from: 0.25 };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 27 }), weight: 400, color: WHITE, opacity: QUIET, enter: "fade", from: 0.45 };
  const portrait: Portrait = { fill: "#1b2a3a", ink: WHITE, rim: TEAL };
  const ringSide = f.by({ square: 150, portrait: 176, story: 214, landscape: 300 });
  const inset = f.px(f.by({ square: 46, portrait: 52, story: 58, landscape: 56 }));

  f.add("ambient", "aurora", 0, 0, f.width, f.height, { ambient: "aurora", fill: GROUND, color: "#16d9b2", highlight: "#9b6bff", react: true, pace: 1.3 });
  orbs(f, a);
  glass(f, "card", a.left, a.top, a.w, a.h, PANE, { enter: "blur", speed: 0.8 });
  // Light catching the top edge of the pane, brighter than the hairline round the rest of it.
  const lip = f.px(PANE.corner) * 1.1;
  f.add("shape", "edge", a.left + lip, a.top - f.px(4), a.w - lip * 2, f.px(8), { shape: "line", fill: WHITE, strokeWidth: 1.5, opacity: 0.45, enter: "wipe", from: 0.4 });

  const inner = column(a.left + inset, a.right - inset);
  const top = header(f, inner, name, handle, portrait);

  if (f.wide) {
    const side = f.px(ringSide) + f.px(80);
    const body = column(inner.x, inner.x + inner.w - side - f.px(64));
    const dial = column(inner.x + inner.w - side, inner.x + inner.w);
    let bodyTop = 0;
    stack(a.top + inset, a.bottom - inset, [top, glintRule(f, inner, 30), { h: 0, gap: 0, draw: (y) => (bodyTop = y) }, space()]);
    stack(bodyTop + f.px(34), a.bottom - inset, [marker(f, inner), heading(f, body, title, 2, 16), space(0.6), captions(f, body, words, 4), space(1)]);
    // The dial on the right: the ring with its figure, a label and the sound under it, centred in their own column.
    stack(bodyTop + f.px(34), a.bottom - inset, [space(), dialRing(f, dial.x + dial.w / 2, ringSide), playing(f, dial, true, 30), bars(f, dial.x, dial.w, 56, TEAL, 18, { enter: "wipe", from: 0.9 }), space()]);
    return;
  }

  stack(a.top + inset, a.bottom - inset, [
    top,
    glintRule(f, inner, f.by({ square: 24, portrait: 30, story: 36, landscape: 0 })),
    marker(f, inner, f.by({ square: 28, portrait: 36, story: 44, landscape: 0 })),
    heading(f, inner, title, 2, 14),
    space(0.8),
    captions(f, inner, words, f.by({ square: 3, portrait: 4, story: 6, landscape: 0 })),
    space(1),
    player(f, inner, ringSide),
  ]);
});

/** The two lights the glass blurs: a large violet orb at the top right corner and a small teal one low on the left,
 *  each half under the pane, drifting on their own beats. */
function orbs(f: Frame, a: ReturnType<typeof area>) {
  const big = f.px(f.by({ square: 360, portrait: 420, story: 480, landscape: 440 }));
  const small = f.px(f.by({ square: 190, portrait: 220, story: 250, landscape: 230 }));
  const bx = Math.min(f.width - big - f.px(6), a.right - big * 0.62);
  const by = Math.max(f.px(6), a.top - big * 0.28);
  f.add("solid", "orb", bx, by, big, big, { solid: "sphere", fill: VIOLET, gloss: true, shadow: false, enter: "zoom", loop: "float", speed: 0.55 });
  const sx = Math.max(f.px(6), a.left - small * 0.32);
  const sy = Math.min(f.height - small - f.px(6), a.bottom - small * 0.7);
  f.add("solid", "orb-small", sx, sy, small, small, { solid: "sphere", fill: "#12c9a6", gloss: true, shadow: false, enter: "zoom", from: 0.15, loop: "float", speed: 0.8 });
}

/** The speaker's row: their photo in a soft teal rim, name over handle, and the LIVE pill at the far end. */
function header(f: Frame, c: Column, name: Style, handle: Style, portrait: Portrait): Block {
  const d = f.by({ square: 84, portrait: 92, story: 104, landscape: 92 });
  const pillW = f.px(124);
  const pillH = f.px(46);
  const nameH = f.lines(name.size ?? 30, 1, 1.3);
  const handleH = f.lines(handle.size ?? 26, 1, 1.3);
  const h = Math.max(f.px(d), nameH + handleH);
  return {
    h,
    gap: 0,
    draw: (y) => {
      avatarAt(f, c.x + f.px(d) / 2, y + h / 2, d, portrait, { enter: "pop", from: 0.15 });
      const x = c.x + f.px(d) + f.px(22);
      const w = c.x + c.w - pillW - f.px(20) - x;
      const top = y + (h - nameH - handleH) / 2;
      f.add("name", "main", x, top, w, nameH, { align: "left", ...name });
      f.add("handle", "main", x, top + nameH, w, handleH, { align: "left", ...handle });
      const px = c.x + c.w - pillW;
      const py = y + (h - pillH) / 2;
      f.add("shape", "live", px, py, pillW, pillH, { shape: "rect", radius: 0.5, fill: "#0b2a27", stroke: TEAL, strokeWidth: 1.5, opacity: 0.92, enter: "pop", from: 0.55, loop: "pulse" });
      const dot = f.px(12);
      f.add("shape", "live-dot", px + f.px(20), py + (pillH - dot) / 2, dot, dot, { shape: "ellipse", fill: TEAL, enter: "pop", from: 0.65, loop: "flash" });
      label(f, "live", "LIVE", px + f.px(42), py + (pillH - f.lines(26, 1, 1)) / 2, { font: GROTESK, size: 26, weight: 700, color: MINT, letterSpacing: 140, enter: "fade", from: 0.7, loop: "pulse" });
    },
  };
}

/** The hairline under the speaker; a band of light runs along it now and then, the glint of the pane's edge. */
function glintRule(f: Frame, c: Column, gap = 0): Block {
  return { h: f.px(8), gap: f.px(gap), draw: (y, h) => f.add("shape", "rule", c.x, y, c.w, h, { shape: "line", fill: WHITE, strokeWidth: 1.5, opacity: 0.22, enter: "wipe", from: 0.35, loop: "shimmer", speed: 0.7 }) };
}

/** A short teal stroke over the title, the one mark of colour that says where to start reading, and the episode
 *  small at the far end of its line. */
function marker(f: Frame, c: Column, gap = 0): Block {
  const h = f.lines(26, 1, 1);
  return {
    h,
    gap: f.px(gap),
    draw: (y) => {
      f.add("shape", "marker", c.x, y + h / 2 - f.px(2), f.px(56), f.px(4), { shape: "rect", radius: 0.5, fill: TEAL, enter: "wipe", from: 0.2 });
      label(f, "episode", "EP. 00", c.x + c.w, y, { font: GROTESK, size: 26, weight: 600, color: WHITE, opacity: QUIET, letterSpacing: 160, align: "right", enter: "fade", from: 0.5 });
    },
  };
}

/** The ring of dots with the share played in its middle, `d` design pixels across, centred on `cx`. */
function dialRing(f: Frame, cx: number, d: number, gap = 0): Block {
  return {
    h: f.px(d),
    gap: f.px(gap),
    draw: (y, h) => {
      f.add("visual", "ring", cx - h / 2, y, h, h, { visual: "ring", color: TEAL, keepLook: true, enter: "iris", from: 0.6 });
      const size = Math.round(d * 0.25);
      const th = f.lines(size, 1, 1.2);
      f.add("time", "main", cx - h * 0.4, y + h / 2 - th / 2, h * 0.8, th, { clock: "percent", align: "center", font: GROTESK, size, weight: 600, color: WHITE, letterSpacing: -20, enter: "flicker", from: 0.85 });
    },
  };
}

/** "Now playing" over the sound, left or centred in its column. */
function playing(f: Frame, c: Column, centred: boolean, gap = 0): Block {
  const style: Style = { font: GROTESK, size: 26, weight: 600, color: MINT, opacity: 0.9, letterSpacing: 180, enter: "fade", from: 0.8 };
  return {
    h: f.lines(26, 1, 1),
    gap: f.px(gap),
    draw: (y) => label(f, "playing", "NOW PLAYING", centred ? c.x + c.w / 2 : c.x, y, { ...style, align: centred ? "center" : "left" }),
  };
}

/** The foot of the card: the ring and its figure, then "Now playing" over the sound running to the far edge. */
function player(f: Frame, c: Column, d: number): Block {
  const side = f.px(d);
  return {
    h: side,
    gap: 0,
    draw: (y) => {
      dialRing(f, c.x + side / 2, d).draw(y, side);
      const right = column(c.x + side + f.px(36), c.x + c.w);
      const barsH = f.px(d * 0.36);
      const labelH = f.lines(26, 1, 1);
      const top = y + (side - labelH - f.px(18) - barsH) / 2;
      playing(f, right, false).draw(top, labelH);
      bars(f, right.x, right.w, d * 0.36, TEAL, 0, { enter: "wipe", from: 0.9 }).draw(top + labelH + f.px(18), barsH);
    },
  };
}
