import type { Art } from "@drkxbt/audiogram";
import { area, avatarAt, captions, card, column, heading, measure, OUTFIT, PAPER, QUIET, row, template, tenth, WHITE, type Block, type Blocks, type Glass, type Style } from "../template-kit.js";

const CREAM = "#fbf5ea";
const SKY = "#bfe0fb";
const NAVY = "#14213d";
const COBALT = "#2f6bff";
// The word being said sits on sunlight: dark ink reads on it, and it is the one warm colour on the card.
const SUN = "#ffcf5c";
const PEACH = "#ffbf9b";

/** A round light fading to nothing at its edge: `steps` discs, each a little smaller and as faint as `each`, laid one on
 *  another, so it is strongest in the middle. Their radii step in widest at the edge, so the light builds slowly there and
 *  no rim shows. */
function glow(d: number, steps: number, each: number): Art {
  const c = d / 2;
  const paths: Art["paths"] = [];
  for (let i = 0; i < steps; i++) {
    const r = tenth(c * (1 - i / steps) ** 1.4);
    paths.push({ d: `M${tenth(c - r)} ${tenth(c)}a${r} ${r} 0 1 0 ${tenth(r * 2)} 0a${r} ${r} 0 1 0 ${tenth(-r * 2)} 0`, fill: "currentColor", opacity: each });
  }
  return { w: tenth(d), h: tenth(d), paths };
}

/**
 * The clean, light option: a cream page where sky and peach light drift slowly, two soft orbs floating behind a white
 * frosted card, and a small glossy sun bobbing at the card's corner. Everything pops in, one part after another; the
 * captions are dark on the glass with the word being said on a rounded patch of sunlight, and the sound runs as bars.
 */
export const daylight = template("daylight", "Daylight", { color: CREAM, to: SKY, angle: 160 }, PAPER, (f) => {
  f.add("ambient", "sky", 0, 0, f.width, f.height, { ambient: "aurora", fill: CREAM, color: "#7cc0f5", highlight: PEACH, pace: 0.7, react: true });

  const pane: Glass = { tint: WHITE, strength: 0.5, frost: 40, corner: 40, edge: 2 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 30, portrait: 32, story: 36, landscape: 30 }), weight: 700, color: NAVY, enter: "pop", from: 0.15 };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 27, story: 30, landscape: 26 }), weight: 500, color: NAVY, opacity: QUIET, enter: "pop", from: 0.22 };
  const title: Style = { font: OUTFIT, size: f.by({ square: 46, portrait: 46, story: 56, landscape: 48 }), weight: 700, color: NAVY, lineHeight: 1.12, letterSpacing: -10, enter: "pop", from: 0.3 };
  const words: Style = { font: OUTFIT, size: f.by({ square: 60, portrait: 64, story: 76, landscape: 60 }), weight: 600, color: NAVY, highlight: SUN, lineHeight: 1.3, letterSpacing: -6 };
  const chip: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 26, story: 30, landscape: 26 }), weight: 700, color: WHITE, letterSpacing: 20 };

  const a = area(f);
  const inset = f.by({ square: 48, portrait: 52, story: 60, landscape: 52 });

  /** Soft coloured light that drifts on its own, a glow with no hard edge, which the frost blurs further where the card
   *  lies over it. */
  const orb = (name: string, cx: number, cy: number, d: number, color: string, loop: Style["loop"]) => {
    const side = f.px(d);
    // Kept wholly on the page, as every layer is, however the shape crops round it.
    const x = Math.min(Math.max(cx - side / 2, 0), f.width - side);
    const y = Math.min(Math.max(cy - side / 2, 0), f.height - side);
    f.add("graphic", name, x, y, side, side, { art: glow(tenth(side), 48, 0.035), color, loop, enter: "zoom" });
  };
  orb("orb-sky", f.width * 0.78, f.height * f.by({ square: 0.2, portrait: 0.2, story: 0.2, landscape: 0.24 }), f.by({ square: 640, portrait: 700, story: 860, landscape: 660 }), "#6fb6ff", "float");
  orb("orb-peach", f.width * 0.18, f.height * 0.82, f.by({ square: 600, portrait: 660, story: 800, landscape: 620 }), PEACH, "sway");

  /** The speaker's photo with a white rim, their name and handle beside it, and an episode chip at the far right. */
  const top = (c: { x: number; w: number }, d: number): Block => {
    const nameH = f.lines(name.size!, 1, 1.25);
    const handleH = f.lines(handle.size!, 1, 1.25);
    const h = Math.max(f.px(d), nameH + handleH);
    return {
      h,
      gap: 0,
      draw: (y) => {
        avatarAt(f, c.x + f.px(d) / 2, y + h / 2, d, { fill: COBALT, ink: WHITE, rim: WHITE }, { enter: "pop", from: 0.08 });
        const x = c.x + f.px(d + 22);
        const line = y + (h - nameH - handleH) / 2;
        f.add("name", "main", x, line, f.px(480), nameH, { align: "left", ...name });
        f.add("handle", "main", x, line + nameH, f.px(480), handleH, { align: "left", ...handle });
        const chipH = f.px(chip.size! * 1.9);
        const chipW = f.px(chip.size! * 5.4);
        const cx = c.x + c.w - chipW;
        const cy = y + (h - chipH) / 2;
        f.add("shape", "chip", cx, cy, chipW, chipH, { shape: "rect", radius: 0.5, fill: NAVY, enter: "pop", from: 0.4, loop: "float" });
        const textH = f.lines(chip.size!, 1, 1);
        f.add("text", "episode", cx + f.px(chip.size! * 0.75), cy + (chipH - textH) / 2, chipW - f.px(chip.size! * 1.5), textH, { text: "Ep. 00", align: "left", lineHeight: 1, enter: "pop", from: 0.4, loop: "float", ...chip });
      },
    };
  };

  /** The sound as bars, and the time played in a cobalt pill at the end of them. */
  const sound = (c: { x: number; w: number }, h: number, gap: number): Block =>
    row(f, h, gap, (y, rowH) => {
      const pillW = f.px(chip.size! * 4.6);
      const pillH = f.px(chip.size! * 1.9);
      f.add("visual", "main", c.x, y, c.w - pillW - f.px(28), rowH, { visual: "bars", color: COBALT, enter: "grow", from: 0.35 });
      const px = c.x + c.w - pillW;
      const py = y + (rowH - pillH) / 2;
      f.add("shape", "pill", px, py, pillW, pillH, { shape: "rect", radius: 0.5, fill: COBALT, enter: "pop", from: 0.5 });
      f.add("time", "elapsed", px, py, pillW, pillH, { ...chip, clock: "elapsed", align: "center", enter: "pop", from: 0.5 });
    });

  const width = f.wide ? f.px(1320) : a.w;
  const x = f.wide ? (f.width - width) / 2 : a.left;
  const inner = column(x + f.px(inset), x + width - f.px(inset));
  const blocks: Blocks = [
    top(inner, f.by({ square: 76, portrait: 84, story: 96, landscape: 76 })),
    heading(f, inner, title, f.by({ square: 2, portrait: 2, story: 3, landscape: 2 }), f.by({ square: 28, portrait: 34, story: 44, landscape: 28 })),
    row(f, 8, f.by({ square: 18, portrait: 22, story: 26, landscape: 18 }), (y, h) => f.add("shape", "rule", inner.x, y, inner.w, h, { shape: "line", fill: NAVY, strokeWidth: 1.5, opacity: 0.24, dash: "dotted", enter: "wipe", direction: "right", from: 0.35 })),
    captions(f, inner, words, f.by({ square: 3, portrait: 3, story: 4, landscape: 3 }), f.by({ square: 24, portrait: 30, story: 40, landscape: 24 })),
    sound(inner, f.by({ square: 64, portrait: 72, story: 84, landscape: 64 }), f.by({ square: 26, portrait: 32, story: 44, landscape: 26 })),
  ];
  const h = measure(blocks) + f.px(inset) * 2;
  // The card sits a little below the middle on the tall shapes, leaving the sky above it for the sun.
  const lift = f.by({ square: 0.5, portrait: 0.6, story: 0.62, landscape: 0.5 });
  const y = a.top + (a.h - h) * lift;
  card(f, "card", x, y, width, inset, pane, blocks, { enter: "rise", speed: 0.8 });

  const sun = f.px(f.by({ square: 120, portrait: 140, story: 180, landscape: 130 }));
  f.add("solid", "sun", x + width - sun * 0.85, Math.max(f.px(20), y - sun * 0.55), sun, sun, { solid: "sphere", fill: SUN, gloss: true, enter: "zoom", from: 0.2, loop: "float" });
});
