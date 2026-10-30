import type { Art } from "@drkxbt/audiogram";
import { area, avatarAt, captions, column, heading, INK, label, OUTFIT, QUIET, row, SERIF, space, stack, template, tenth, WHITE, type Block, type Column, type Frame, type Portrait, type Style } from "../template-kit.js";

/* Night sky in deep indigo: specks of light drifting up and swelling with the voice, and in the middle a glossy planet
   floating in a wide violet glow, ringed by a tilted orbit the speaker's photo rides on like a moon. Everything is set
   on the centre line, the captions large under it. */

const NIGHT = "#0c0a33";
const AURA = "#5a3fd8";
const STAR = "#e6e2ff";
const ICE = "#9fd8ff";
const LILAC = "#c4bbff";
const PLANET = "#8a78ff";
const GLOW = "#b3a6ff";

// Tilted against the page so the ring reads as a plane in space, not a flat oval.
const TILT = -12;
const ORBIT_X = 1.1;
const ORBIT_Y = 0.28;
// Where the moon sits round the orbit, in degrees from its right end towards the near side.
const MOON_AT = 40;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A point on the orbit at `angle` degrees round it, from its middle, in the same lengths as `rx` and `ry`. */
function onOrbit(rx: number, ry: number, angle: number) {
  const x = rx * Math.cos(rad(angle));
  const y = ry * Math.sin(rad(angle));
  return { x: x * Math.cos(rad(TILT)) - y * Math.sin(rad(TILT)), y: x * Math.sin(rad(TILT)) + y * Math.cos(rad(TILT)) };
}

/** Half the tilted orbit as a drawing `w` by `h`: the far half runs over the top of the planet, the near half under it,
 *  so the two can be laid on either side of it and the ring passes behind and then in front. */
function orbitHalf(w: number, h: number, rx: number, ry: number, near: boolean, width: number): Art {
  const end = onOrbit(rx, ry, 0);
  const [cx, cy] = [w / 2, h / 2];
  const d = `M${tenth(cx - end.x)} ${tenth(cy - end.y)}A${tenth(rx)} ${tenth(ry)} ${TILT} 0 ${near ? 0 : 1} ${tenth(cx + end.x)} ${tenth(cy + end.y)}`;
  return { w: tenth(w), h: tenth(h), paths: [{ d, stroke: "currentColor", width }] };
}

/** Half of a wider orbit as a dotted line, a drawing `w` by `h` laid over the same middle as the solid one. */
function dottedHalf(w: number, h: number, rx: number, ry: number, near: boolean, r: number): Art {
  let d = "";
  const count = 84;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    if (Math.sin(rad(angle)) >= 0 !== near) continue;
    const p = onOrbit(rx, ry, angle);
    const [x, y] = [w / 2 + p.x, h / 2 + p.y];
    d += `M${tenth(x - r)} ${tenth(y)}a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(r * 2)} 0a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(-r * 2)} 0`;
  }
  return { w: tenth(w), h: tenth(h), paths: [{ d, fill: "currentColor" }] };
}

/** The planet `d` design pixels across centred on a point, its glow, orbit, moon and the stars glinting round it. */
function planet(f: Frame, cx: number, cy: number, d: number, moon: number, portrait: Portrait): void {
  const D = f.px(d);
  // Two discs under a pane of the strongest frost, a wide violet one and a bright one: the pane blurs them into a glow
  // that falls off from the planet, and turns the specks behind it to out-of-focus light, which sets it in front.
  const aura = D * 2;
  f.add("shape", "aura", cx - aura / 2, cy - aura / 2, aura, aura, { shape: "ellipse", fill: AURA, opacity: 0.5, enter: "fade", speed: 0.4 });
  const glow = D * 1.2;
  f.add("shape", "glow", cx - glow / 2, cy - glow / 2, glow, glow, { shape: "ellipse", fill: GLOW, loop: "float", enter: "fade", speed: 0.6 });
  // Tinted with the glow's own colour, the pane reads as the planet's atmosphere rather than a disc cut out of the sky.
  const halo = D * 3.1;
  f.add("shape", "halo", cx - halo / 2, cy - halo / 2, halo, halo, { shape: "ellipse", fill: GLOW, opacity: 0.025, frost: 60 });

  const rx = D * ORBIT_X;
  const ry = D * ORBIT_Y;
  const w = 2 * Math.hypot(rx * Math.cos(rad(TILT)), ry * Math.sin(rad(TILT))) + f.px(8);
  const h = 2 * Math.hypot(rx * Math.sin(rad(TILT)), ry * Math.cos(rad(TILT))) + f.px(8);
  const line = Math.max(1.5, f.px(2));
  const ring = (name: string, near: boolean, style: Style) =>
    f.add("graphic", name, cx - w / 2, cy - h / 2, w, h, { art: orbitHalf(w, h, rx, ry, near, line), color: LILAC, enter: "wipe", direction: "right", ...style });
  // A wider orbit of fine dots, fainter, round the solid one: the far halves go behind the planet, the near in front.
  const ox = D * 1.5;
  const oy = D * 0.4;
  const ow = 2 * Math.hypot(ox * Math.cos(rad(TILT)), oy * Math.sin(rad(TILT))) + f.px(8);
  const oh = 2 * Math.hypot(ox * Math.sin(rad(TILT)), oy * Math.cos(rad(TILT))) + f.px(8);
  const belt = (name: string, near: boolean, opacity: number) =>
    f.add("graphic", name, cx - ow / 2, cy - oh / 2, ow, oh, { art: dottedHalf(ow, oh, ox, oy, near, Math.max(1.2, f.px(1.8))), color: STAR, opacity, enter: "wipe", direction: "left", from: 0.5 });
  belt("belt-far", false, 0.3);
  ring("orbit-far", false, { opacity: 0.4, from: 0.3 });
  f.add("solid", "planet", cx - D / 2, cy - D / 2, D, D, { solid: "sphere", fill: PLANET, gloss: true, shadow: false, loop: "float", enter: "zoom", speed: 0.6 });
  ring("orbit-near", true, { opacity: 0.85, from: 0.45 });
  belt("belt-near", true, 0.5);

  const at = onOrbit(rx, ry, MOON_AT);
  avatarAt(f, cx + at.x, cy + at.y, moon, portrait, { enter: "pop", from: 0.7, loop: "float" });

  // Three glints at their own times, so they twinkle out of step with one another.
  const glints: Array<[number, number, number]> = [[-1.22, -0.56, 0.13], [1.12, -0.66, 0.09], [-0.78, 0.6, 0.07]];
  glints.forEach(([x, y, size], index) => {
    const s = D * size;
    f.add("shape", `glint-${index + 1}`, cx + D * x - s / 2, cy + D * y - s / 2, s, s, { shape: "sparkle", fill: STAR, opacity: 0.9, enter: "pop", from: 0.9 + index * 0.45, loop: "flash" });
  });
}

export const stardust = template("stardust", "Stardust", { color: "#16113f", to: "#06051a", angle: 180 }, INK, (f) => {
  const a = area(f);
  const portrait: Portrait = { fill: LILAC, ink: "#1b1450", rim: STAR };
  const kickerSize = f.by({ square: 26, portrait: 26, story: 28, landscape: 26 });
  const kicker: Style = { font: OUTFIT, size: kickerSize, weight: 600, color: LILAC, opacity: 0.9, uppercase: true, letterSpacing: 360, align: "center", enter: "spread", from: 0.15 };
  const title: Style = { font: SERIF, size: f.by({ square: 52, portrait: 54, story: 54, landscape: 52 }), weight: 400, color: WHITE, align: "center", lineHeight: 1.08, enter: "spread", from: 0.35 };
  const words: Style = { font: OUTFIT, size: f.by({ square: 50, portrait: 56, story: 62, landscape: 54 }), weight: 600, color: WHITE, highlight: LILAC, align: "center", lineHeight: 1.28, shadow: true, enter: "glide", from: 0.5 };
  const name: Style = { font: OUTFIT, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 30 }), weight: 600, color: WHITE, align: "center", enter: "rise", from: 0.8 };
  const handle: Style = { font: OUTFIT, size: f.by({ square: 26, portrait: 26, story: 28, landscape: 26 }), weight: 400, color: LILAC, opacity: QUIET + 0.07, align: "center", enter: "rise", from: 0.9 };
  const clock: Style = { font: OUTFIT, size: 26, weight: 500, color: LILAC, opacity: 0.9, enter: "fade", from: 1 };

  // The sky: specks rising through indigo, swelling with the voice.
  f.add("ambient", "sky", 0, 0, f.width, f.height, { ambient: "particles", fill: NIGHT, color: STAR, highlight: ICE, react: true, pace: 0.7 });

  // Drawn once the stack is laid, so they land over the planet's frosted halo instead of being blurred by it.
  const last: Array<() => void> = [];

  /** The episode set wide between two hairlines that draw outwards from it. */
  const episode = (cx: number, gap: number): Block =>
    row(f, kickerSize, gap, (y, h) => last.push(() => {
      label(f, "kicker", "Ep. 00", cx, y, kicker, 0.66);
      const half = f.px(kickerSize * 6 * (0.66 + 0.36)) / 2 + f.px(26);
      const reach = f.px(96);
      for (const [side, way] of [[-1, "left"], [1, "right"]] as const) {
        const x = side < 0 ? cx - half - reach : cx + half;
        f.add("shape", `kicker-${way}`, x, y + h / 2 - f.px(4), reach, f.px(8), { shape: "line", fill: LILAC, strokeWidth: 1.5, opacity: 0.55, enter: "wipe", direction: way, from: 0.25 });
      }
    }));

  /** The sound as a field of lights, with the time played at its left end and the time left at its right. */
  const player = (cx: number, w: number, h: number, gap: number): Block =>
    row(f, h, gap, (y, height) => {
      const width = f.px(w);
      f.add("visual", "main", cx - width / 2, y, width, height, { visual: "dots", color: LILAC, enter: "unfold", from: 0.7 });
      const clockW = f.px(96);
      const clockH = f.lines(26, 1, 1.2);
      const mid = y + height / 2 - clockH / 2;
      f.add("time", "elapsed", cx - width / 2 - f.px(22) - clockW, mid, clockW, clockH, { ...clock, clock: "elapsed", align: "right" });
      f.add("time", "remaining", cx + width / 2 + f.px(22), mid, clockW, clockH, { ...clock, clock: "remaining", align: "left" });
    });

  /** The speaker's name over their handle, centred. */
  const signature = (c: Column, gap: number): Block => {
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    return {
      h: nameH + handleH,
      gap: f.px(gap),
      draw: (y) => {
        f.add("name", "main", c.x, y, c.w, nameH, name);
        f.add("handle", "main", c.x, y + nameH, c.w, handleH, handle);
      },
    };
  };

  if (f.wide) {
    // The planet holds the left of the frame, the words the right, both on their own centre lines.
    const sky = f.px(760);
    planet(f, a.left + sky / 2, f.height / 2, 260, 116, portrait);
    const c = column(a.left + sky + f.px(60), a.right);
    const cx = c.x + c.w / 2;
    stack(a.top, a.bottom, [
      episode(cx, 0),
      heading(f, c, title, 2, 34),
      space(0.6),
      captions(f, c, words, 3, 20),
      space(0.6),
      player(cx, 480, 96, 20),
      signature(c, 40),
    ]);
    last.forEach((draw) => draw());
    return;
  }

  const c = column(a.left, a.right);
  const cx = f.width / 2;
  const d = f.by({ square: 168, portrait: 220, story: 300, landscape: 0 });
  stack(a.top, a.bottom, [
    episode(cx, 0),
    space(0.5),
    row(f, d * 1.3, f.by({ square: 10, portrait: 24, story: 40, landscape: 0 }), (y, h) => planet(f, cx, y + h / 2, d, d * 0.46, portrait)),
    space(0.5),
    heading(f, c, title, 2, f.by({ square: 10, portrait: 24, story: 40, landscape: 0 })),
    captions(f, c, words, f.by({ square: 3, portrait: 3, story: 4, landscape: 0 }), f.by({ square: 16, portrait: 26, story: 36, landscape: 0 })),
    space(0.6),
    player(cx, f.by({ square: 480, portrait: 520, story: 560, landscape: 0 }), f.by({ square: 92, portrait: 100, story: 112, landscape: 0 }), 16),
    signature(c, f.by({ square: 22, portrait: 30, story: 44, landscape: 0 })),
  ]);
  last.forEach((draw) => draw());
});
