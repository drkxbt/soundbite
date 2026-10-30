import { area, avatarAt, captions, column, GROTESK, heading, icon, INK, INTER, label, MONO, OUTFIT, QUIET, space, stack, template, WHITE, glass, type Block, type Column, type Frame, type Style } from "../template-kit.js";
import type { Art } from "@drkxbt/audiogram";

const MAGENTA = "#ff2bd6";
const CYAN = "#22e6ff";
const NIGHT = "#07050c";
// Where the grid's floor meets its sky, as a share of the frame's height; the ambient draws its horizon there.
const HORIZON = 0.56;

/**
 * A late-night studio: a neon grid floor running towards a glowing horizon, the sound standing on that horizon as a
 * mirrored skyline, the title lit like a sign, a flashing ON AIR tag and a running clock, and thin magenta and cyan
 * hairlines with ticks at the corners. The captions hang in the dark sky above the floor, where nothing crosses them.
 */
export const neonStudio = template("neon-studio", "Neon Studio", { color: "#0b0812", to: "#040309", angle: 180 }, INK, (f) => {
  const a = area(f);
  const words: Style = { font: INTER, size: f.by({ square: 66, portrait: 76, story: 88, landscape: 78 }), weight: 700, color: WHITE, highlight: CYAN, lineHeight: 1.24, letterSpacing: -10 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 50, portrait: 54, story: 54, landscape: 52 }), weight: 500, color: "#ff5ee0", effect: "neon", lineHeight: 1.15, letterSpacing: -10, enter: "flicker", from: 0.35, speed: 0.7 };
  const horizon = f.height * HORIZON;
  const skyline = f.px(f.by({ square: 150, portrait: 180, story: 220, landscape: 170 }));

  f.add("ambient", "grid", 0, 0, f.width, f.height, { ambient: "grid", fill: NIGHT, color: MAGENTA, highlight: CYAN, react: true, pace: 0.9 });
  corners(f);

  const c = column(a.left, a.right);
  const sky = horizon - skyline / 2 - f.px(f.by({ square: 26, portrait: 40, story: 60, landscape: 30 }));
  f.add("visual", "main", c.x, horizon - skyline / 2, c.w, skyline, { visual: "mirror", color: CYAN, enter: "unfold", from: 0.8 });

  if (f.wide) {
    // A wide frame takes a long title on one line, which leaves the sky's height to the captions, set full width.
    stack(a.top, sky, [onAir(f, c), hairline(f, c, 22), heading(f, c, { ...title, size: 52 }, 1, 26), space(1), captions(f, c, words, 2), space(0.6)]);
    studioCard(f, c.x, horizon + skyline / 2, a.bottom);
    return;
  }

  stack(a.top, sky, [
    onAir(f, c),
    hairline(f, c, f.by({ square: 18, portrait: 24, story: 30, landscape: 0 })),
    heading(f, c, title, 2, f.by({ square: 26, portrait: 34, story: 44, landscape: 0 })),
    space(1),
    captions(f, c, words, f.by({ square: 2, portrait: 3, story: 5, landscape: 0 })),
    space(0.6),
  ]);
  studioCard(f, c.x, horizon + skyline / 2, a.bottom);
});

/** An L of hairline at each corner of the frame, as a monitor's safe area is marked; magenta above, cyan below. */
function corners(f: Frame) {
  const side = f.px(44);
  const inset = f.pad * 0.42;
  const width = 2.5;
  const half = width / 2;
  const tick = (d: string): Art => ({ w: 44, h: 44, paths: [{ d, stroke: "currentColor", width }] });
  const marks: Array<[string, number, number, string, string, number]> = [
    ["corner-tl", inset, inset, `M${half} 44V${half}H44`, MAGENTA, 0.2],
    ["corner-tr", f.width - inset - side, inset, `M0 ${half}H${44 - half}V44`, MAGENTA, 0.3],
    ["corner-bl", inset, f.height - inset - side, `M${half} 0V${44 - half}H44`, CYAN, 0.4],
    ["corner-br", f.width - inset - side, f.height - inset - side, `M0 ${44 - half}H${44 - half}V0`, CYAN, 0.5],
  ];
  for (const [name, x, y, d, color, from] of marks) {
    f.add("graphic", name, x, y, side, side, { art: tick(d), color, opacity: 0.9, enter: "fade", from });
  }
}

/** The top line: the ON AIR tag flashing at the left, the time played running at the right like a desk's clock. */
function onAir(f: Frame, c: Column): Block {
  const tagW = f.px(176);
  const tagH = f.px(50);
  return {
    h: tagH,
    gap: 0,
    draw: (y) => {
      f.add("shape", "on-air", c.x, y, tagW, tagH, { shape: "rect", radius: 0.16, fill: "#22061c", stroke: MAGENTA, strokeWidth: 2, enter: "flicker", from: 0.1, loop: "flash" });
      const dot = f.px(12);
      f.add("shape", "on-air-dot", c.x + f.px(20), y + (tagH - dot) / 2, dot, dot, { shape: "ellipse", fill: "#ff4b6e", enter: "flicker", from: 0.2, loop: "heartbeat" });
      label(f, "on-air", "ON AIR", c.x + f.px(44), y + (tagH - f.lines(26, 1, 1)) / 2, { font: GROTESK, size: 26, weight: 700, color: "#ffd1f4", effect: "neon", letterSpacing: 160, enter: "flicker", from: 0.2, loop: "flash" }, 0.66);
      const clockH = f.lines(30, 1, 1.2);
      const w = f.px(200);
      f.add("time", "main", c.x + c.w - w, y + (tagH - clockH) / 2, w, clockH, { clock: "elapsed", align: "right", font: MONO, size: 30, weight: 400, color: CYAN, opacity: 0.92, letterSpacing: 60, enter: "fade", from: 0.4 });
    },
  };
}

/** A cyan hairline across the column with a short magenta run at its start. */
function hairline(f: Frame, c: Column, gap = 0): Block {
  return {
    h: f.px(8),
    gap: f.px(gap),
    draw: (y, h) => {
      f.add("shape", "hairline", c.x, y, c.w, h, { shape: "line", fill: CYAN, strokeWidth: 1.5, opacity: 0.45, enter: "wipe", from: 0.25 });
      f.add("shape", "hairline-accent", c.x, y, f.px(120), h, { shape: "line", fill: MAGENTA, strokeWidth: 3, enter: "wipe", from: 0.45 });
    },
  };
}

/** The speaker on a chip of smoked glass on the floor, so the grid's lines blur under them instead of crossing them;
 *  centred in the floor between the skyline's foot and `bottom`. */
function studioCard(f: Frame, x: number, top: number, bottom: number) {
  const d = f.by({ square: 84, portrait: 92, story: 108, landscape: 88 });
  const name: Style = { font: OUTFIT, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 32 }), weight: 600, color: WHITE, enter: "shift", from: 0.75 };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 27 }), weight: 400, color: "#9ff3ff", opacity: QUIET, enter: "fade", from: 0.9 };
  const inset = f.px(22);
  const nameH = f.lines(name.size!, 1, 1.3);
  const handleH = f.lines(handle.size!, 1, 1.3);
  const h = Math.max(f.px(d), nameH + handleH) + inset * 2;
  const w = f.px(f.by({ square: 470, portrait: 500, story: 560, landscape: 520 }));
  // Low on the floor, like a lower third, so the grid runs open between the skyline and the speaker.
  const y = top + Math.max(0, (bottom - top - h) * 0.72);
  glass(f, "speaker", x, y, w, h, { tint: NIGHT, strength: 0.5, frost: 18, corner: 22, edge: 1.5 }, { stroke: MAGENTA, enter: "rise", from: 0.6 });
  const cx = x + inset + f.px(d) / 2;
  const cy = y + h / 2;
  // A cyan tube round the photo, drawn as a ring so it glows over the floor rather than filling a disc behind it.
  const r = f.px(d) / 2 + f.px(6);
  f.add("shape", "rim", cx - r, cy - r, r * 2, r * 2, { shape: "ellipse", fill: NIGHT, stroke: CYAN, strokeWidth: 2.5, enter: "pop", from: 0.7, loop: "pulse" });
  avatarAt(f, cx, cy, d, { fill: "#2a0d2a", ink: WHITE }, { enter: "pop", from: 0.7 });
  const tx = x + inset + f.px(d) + f.px(20);
  const tw = x + w - inset - tx;
  const ty = y + (h - nameH - handleH) / 2;
  f.add("name", "main", tx, ty, tw, nameH, { align: "left", ...name });
  f.add("handle", "main", tx, ty + nameH, tw, handleH, { align: "left", ...handle });
  // The episode at the far end of the speaker's line, with the headphones that say it is a show.
  const right = f.width - f.pad;
  const labelH = f.lines(26, 1, 1);
  const ly = y + (h - labelH) / 2;
  const episode: Style = { font: MONO, size: 26, weight: 400, color: WHITE, opacity: QUIET, letterSpacing: 80, align: "right", enter: "fade", from: 1 };
  label(f, "episode", "EP. 00", right, ly, episode, 0.6);
  // Space Mono runs 0.6 of its size a letter; the icon sits a gap clear of where the words start.
  const wordsW = f.px(26 * 6 * (0.6 + 0.08));
  icon(f, "episode", "headphones", right - wordsW - f.px(16 + 30), y + (h - f.px(30)) / 2, 30, CYAN, 0.9, { enter: "fade", from: 1 });
}
