/* Classic ornaments for the podcast designs: laurels, a crown, a fleur-de-lis, flourished corners, Art Deco fans and
   steps, a wax seal, a ribbon microphone. Each is drawn here as path data rather than taken from an icon set, so it
   scales cleanly, carries no licence of its own and stays well inside the size a saved kit allows for a drawing.
   "currentColor" takes the layer's colour, so one ornament serves gold, ivory or ink. Free of the DOM. */
import type { Art } from "@drkxbt/audiogram";

type Paths = Art["paths"];

/** A number short enough for path data: one decimal place, no trailing zero. */
const n = (value: number) => String(Math.round(value * 10) / 10);
const pt = (x: number, y: number) => `${n(x)},${n(y)}`;

/** A circle as a closed path, drawn clockwise so it can cut a hole with the even-odd rule. */
function circle(cx: number, cy: number, r: number): string {
  return `M${pt(cx - r, cy)}a${n(r)},${n(r)} 0 1,0 ${n(r * 2)},0a${n(r)},${n(r)} 0 1,0 ${n(-r * 2)},0Z`;
}

/** A pointed leaf from its base along `angle` radians, `length` long and about `width` across at its widest, its sides
 *  swelling early and drawing in to the tip as a bay leaf does. */
function leaf(x: number, y: number, angle: number, length: number, width: number): string {
  const ax = Math.cos(angle) * length;
  const ay = Math.sin(angle) * length;
  const nx = -Math.sin(angle) * width * 0.62;
  const ny = Math.cos(angle) * width * 0.62;
  const at = (along: number, side: number) => pt(x + ax * along + nx * side, y + ay * along + ny * side);
  return `M${pt(x, y)}C${at(0.18, 1)} ${at(0.66, 0.92)} ${at(1, 0)}C${at(0.66, -0.92)} ${at(0.18, -1)} ${pt(x, y)}Z`;
}

/** A four-pointed sparkle centred on a point. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.16;
  return `M${pt(cx, cy - r)}Q${pt(cx + k, cy - k)} ${pt(cx + r, cy)}Q${pt(cx + k, cy + k)} ${pt(cx, cy + r)}Q${pt(cx - k, cy + k)} ${pt(cx - r, cy)}Q${pt(cx - k, cy - k)} ${pt(cx, cy - r)}Z`;
}

/** A diamond centred on a point, `w` across and `h` tall. */
function lozenge(cx: number, cy: number, w: number, h: number): string {
  return `M${pt(cx, cy - h / 2)}L${pt(cx + w / 2, cy)}L${pt(cx, cy + h / 2)}L${pt(cx - w / 2, cy)}Z`;
}

/** A spiral curl turning `turns` times from radius `from` out to `to`, starting at `start` radians, as a polyline. */
function curl(cx: number, cy: number, from: number, to: number, start: number, turns: number, clockwise = true): string {
  const steps = Math.max(12, Math.round(turns * 28));
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + (clockwise ? 1 : -1) * t * turns * Math.PI * 2;
    const r = from + (to - from) * t;
    d += `${i ? "L" : "M"}${pt(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)}`;
  }
  return d;
}

/**
 * A laurel wreath open at the top, two branches rising round a circle from a tie at the bottom, their leaves in
 * pairs along the stem and smaller towards the tips.
 */
export function laurelWreath(): Art {
  const w = 400;
  const h = 400;
  const cx = 200;
  const cy = 205;
  const r = 160;
  let leaves = "";
  let stems = "";
  const count = 11;
  for (const side of [-1, 1]) {
    // From just off the bottom up to well short of the top, measured from straight down.
    const first = 0.16;
    const last = 2.55;
    const at = (t: number) => {
      const a = first + (last - first) * t;
      return { x: cx + side * Math.sin(a) * r, y: cy + Math.cos(a) * r, a };
    };
    stems += `M${pt(at(0).x, at(0).y)}`;
    for (let i = 1; i <= 24; i++) stems += `L${pt(at(i / 24).x, at(i / 24).y)}`;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.4) / count;
      const p = at(t);
      // The way along the stem, towards the tip.
      const along = Math.atan2(-Math.sin(p.a) * r, side * Math.cos(p.a) * r);
      const size = 46 - t * 18;
      leaves += leaf(p.x, p.y, along - side * 0.62, size, size * 0.3);
      leaves += leaf(p.x, p.y, along + side * 0.62, size * 0.92, size * 0.28);
    }
    // A single leaf finishing each tip.
    const tip = at(1);
    leaves += leaf(tip.x, tip.y, Math.atan2(-Math.sin(tip.a), side * Math.cos(tip.a)), 30, 9);
  }
  // The tie where the two stems cross, with its two ends hanging down.
  const tie = `${circle(cx, cy + r + 4, 9)}M${pt(cx - 4, cy + r + 10)}L${pt(cx - 22, cy + r + 38)}L${pt(cx - 10, cy + r + 36)}L${pt(cx - 2, cy + r + 14)}ZM${pt(cx + 4, cy + r + 10)}L${pt(cx + 22, cy + r + 38)}L${pt(cx + 10, cy + r + 36)}L${pt(cx + 2, cy + r + 14)}Z`;
  return { w, h: h + 20, paths: [{ d: stems, stroke: "currentColor", width: 4 }, { d: leaves + tie, fill: "currentColor" }] };
}

/** One laurel sprig running left to right along a stem that rises gently, its leaves set alternately and shrinking
 *  towards the tip; mirror it for the other side. */
export function laurelSprig(): Art {
  const w = 300;
  const h = 100;
  const at = (t: number) => ({ x: 14 + t * 268, y: 66 - Math.sin(t * Math.PI * 0.55) * 24 });
  let stem = `M${pt(at(0).x, at(0).y)}`;
  for (let i = 1; i <= 16; i++) stem += `L${pt(at(i / 16).x, at(i / 16).y)}`;
  let leaves = "";
  const count = 11;
  for (let i = 0; i < count; i++) {
    const t = 0.03 + (i / count) * 0.9;
    const p = at(t);
    const next = at(t + 0.01);
    const along = Math.atan2(next.y - p.y, next.x - p.x);
    const size = 48 - t * 22;
    leaves += leaf(p.x, p.y, along + (i % 2 ? 0.6 : -0.6), size, size * 0.34);
  }
  const tip = at(1);
  const before = at(0.98);
  leaves += leaf(tip.x, tip.y, Math.atan2(tip.y - before.y, tip.x - before.x), 26, 9);
  return { w, h, paths: [{ d: stem, stroke: "currentColor", width: 3 }, { d: leaves, fill: "currentColor" }] };
}

/** A five-pointed crown on a jewelled band, an orb on each point. */
export function crown(): Art {
  const body = `M30,112L18,42L64,82L100,22L136,82L182,42L170,112Z`;
  const band = `M28,116H172V140H28Z`;
  const orbs = circle(18, 36, 9) + circle(100, 15, 10) + circle(182, 36, 9) + circle(64, 76, 6) + circle(136, 76, 6);
  // Jewels cut into the band, so the page shows through them.
  const jewels = lozenge(100, 128, 16, 16) + circle(60, 128, 5.5) + circle(140, 128, 5.5);
  return { w: 200, h: 150, paths: [{ d: body + orbs, fill: "currentColor" }, { d: band + jewels, fill: "currentColor", rule: "evenodd" }] };
}

/** A fleur-de-lis: the upright petal, the two that curl out and down, the band, and the foot. */
export function fleurDeLis(): Art {
  const centre = `M50,4C63,24 65,46 56,64H44C35,46 37,24 50,4Z`;
  const right = `M57,62C70,38 93,36 97,54C100,68 88,77 79,70C86,66 86,58 79,56C71,55 64,63 61,71Z`;
  const left = `M43,62C30,38 7,36 3,54C0,68 12,77 21,70C14,66 14,58 21,56C29,55 36,63 39,71Z`;
  const band = `M28,67H72V76H28Z`;
  const foot = `M44,77C41,92 31,101 24,106C35,107 45,98 50,88C55,98 65,107 76,106C69,101 59,92 56,77Z`;
  return { w: 100, h: 110, paths: [{ d: centre + right + left + band + foot, fill: "currentColor" }] };
}

/** A top-left corner: two fine rules along the edges ending in curls, and a lozenge where they meet. Turn or flip it for
 *  the other corners. */
export function flourishCorner(): Art {
  const w = 220;
  const h = 220;
  const rules = `M14,206V14H206M30,190V30H190`;
  const curls = curl(206, 26, 1, 12, Math.PI, 1.3) + curl(26, 206, 1, 12, -Math.PI / 2, 1.3, false);
  const swirl = `M30,92C30,58 58,30 92,30`;
  return {
    w,
    h,
    paths: [
      { d: rules + swirl, stroke: "currentColor", width: 3 },
      { d: curls, stroke: "currentColor", width: 3 },
      { d: lozenge(22, 22, 22, 22) + circle(56, 56, 5), fill: "currentColor" },
    ],
  };
}

/** An Art Deco corner: rules stepping in towards the corner, three deep, with a small square at the step. */
export function decoCorner(): Art {
  const step = (o: number) => `M${o},${200 - o}V${60 + o}H${30 + o}V${30 + o}H${60 + o}V${o}H${200 - o}`;
  return {
    w: 200,
    h: 200,
    paths: [
      { d: step(4) + step(16), stroke: "currentColor", width: 3 },
      { d: lozenge(46, 46, 14, 14), fill: "currentColor" },
    ],
  };
}

/** An Art Deco fan: alternate rays spread from the middle of the bottom edge, inside two arcs. */
export function decoFan(): Art {
  const w = 400;
  const h = 210;
  const cx = 200;
  const cy = 205;
  const reach = 195;
  const rays = 15;
  let fan = "";
  for (let i = 0; i < rays; i += 2) {
    const a0 = Math.PI + (i / rays) * Math.PI;
    const a1 = Math.PI + ((i + 1) / rays) * Math.PI;
    fan += `M${pt(cx, cy)}L${pt(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach)}L${pt(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach)}Z`;
  }
  const arc = (r: number) => `M${pt(cx - r, cy)}A${n(r)},${n(r)} 0 0,1 ${pt(cx + r, cy)}`;
  return { w, h, paths: [{ d: fan, fill: "currentColor" }, { d: arc(70) + arc(120), stroke: "currentColor", width: 4 }] };
}

/** Rays all round a point, long and short in turn, for a sunburst behind a title or a seal. */
export function sunburst(): Art {
  const c = 200;
  let rays = "";
  const count = 48;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const reach = i % 2 ? 150 : 196;
    const spread = 0.022;
    rays += `M${pt(c + Math.cos(a - spread) * 40, c + Math.sin(a - spread) * 40)}L${pt(c + Math.cos(a) * reach, c + Math.sin(a) * reach)}L${pt(c + Math.cos(a + spread) * 40, c + Math.sin(a + spread) * 40)}Z`;
  }
  return { w: 400, h: 400, paths: [{ d: rays, fill: "currentColor" }] };
}

/** A centred divider: a lozenge between two rules that taper away into dots. */
export function divider(): Art {
  const w = 600;
  const h = 40;
  const rules = `M60,20H262M338,20H540`;
  const dots = circle(40, 20, 3.5) + circle(560, 20, 3.5) + circle(276, 20, 4) + circle(324, 20, 4);
  return { w, h, paths: [{ d: rules, stroke: "currentColor", width: 2 }, { d: lozenge(300, 20, 26, 26) + dots, fill: "currentColor" }] };
}

/** A divider with a scroll at its heart: two curls back to back between fine rules. */
export function scrollDivider(): Art {
  const w = 600;
  const h = 70;
  const rules = `M30,35H230M370,35H570`;
  const scroll = curl(272, 35, 2, 22, 0, 1.15, false) + curl(328, 35, 2, 22, Math.PI, 1.15, false) + `M250,35H350`;
  return { w, h, paths: [{ d: rules, stroke: "currentColor", width: 2 }, { d: scroll, stroke: "currentColor", width: 3 }, { d: lozenge(300, 35, 12, 12), fill: "currentColor" }] };
}

/** A wax seal: a round, softly lobed edge and a raised ring inside it, for a monogram to sit on. */
export function waxSeal(): Art {
  const c = 110;
  let edge = "";
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 96 + 5 * Math.sin(a * 9) + 2.5 * Math.sin(a * 23 + 1.3);
    edge += `${i ? "L" : "M"}${pt(c + Math.cos(a) * r, c + Math.sin(a) * r)}`;
  }
  return {
    w: 220,
    h: 220,
    paths: [
      { d: `${edge}Z`, fill: "currentColor" },
      { d: circle(c, c, 70), stroke: "rgba(0,0,0,0.28)", width: 6 },
      { d: circle(c, c - 2, 70), stroke: "rgba(255,255,255,0.16)", width: 2 },
    ],
  };
}

/** A rosette: a scalloped medal with two rings inside it. */
export function rosette(): Art {
  const c = 110;
  let edge = "";
  const lobes = 16;
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2;
    const a1 = ((i + 1) / lobes) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    if (!i) edge += `M${pt(c + Math.cos(a0) * 92, c + Math.sin(a0) * 92)}`;
    edge += `Q${pt(c + Math.cos(am) * 112, c + Math.sin(am) * 112)} ${pt(c + Math.cos(a1) * 92, c + Math.sin(a1) * 92)}`;
  }
  return { w: 220, h: 220, paths: [{ d: `${edge}Z${circle(c, c, 74)}`, fill: "currentColor", rule: "evenodd" }, { d: circle(c, c, 64), stroke: "currentColor", width: 3 }] };
}

/** A ring of beads round a circle, for a cameo frame about a portrait. */
export function beadRing(): Art {
  const c = 200;
  let beads = "";
  const count = 44;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    beads += circle(c + Math.cos(a) * 186, c + Math.sin(a) * 186, i % 2 ? 4 : 6);
  }
  return { w: 400, h: 400, paths: [{ d: circle(c, c, 172) + circle(c, c, 164), stroke: "currentColor", width: 3 }, { d: beads, fill: "currentColor" }] };
}

/** A ribbon microphone of the broadcast age: a rounded capsule with grille slits, its yoke and a stepped foot. */
export function ribbonMic(): Art {
  const capsule = `M60,70C60,30 80,14 100,14C120,14 140,30 140,70V150C140,184 122,198 100,198C78,198 60,184 60,150Z`;
  let slits = "";
  for (let y = 48; y <= 170; y += 14) slits += `M74,${y}H126V${y + 5}H74Z`;
  const yoke = `M44,110V170C44,214 70,230 100,230C130,230 156,214 156,170V110`;
  const stand = `M93,230H107V286H93ZM58,286H142L152,304H48Z`;
  return {
    w: 200,
    h: 310,
    paths: [
      { d: capsule + slits, fill: "currentColor", rule: "evenodd" },
      { d: yoke, stroke: "currentColor", width: 9 },
      { d: stand + circle(44, 110, 9) + circle(156, 110, 9), fill: "currentColor" },
    ],
  };
}

/** Sparkles of three sizes, scattered as though catching the light. */
export function sparkles(): Art {
  return { w: 200, h: 200, paths: [{ d: sparkle(70, 80, 46) + sparkle(150, 44, 22) + sparkle(146, 150, 16), fill: "currentColor" }] };
}

/** A diamond trellis across a `w` by `h` box, cells `cell` across, as fine crossing rules for a quiet ground. */
export function trellis(w: number, h: number, cell: number): Art {
  let d = "";
  // Rules one way, then the other, each running corner to corner of the cells.
  for (let start = -h; start <= w; start += cell) d += `M${pt(start, 0)}L${pt(start + h, h)}`;
  for (let start = 0; start <= w + h; start += cell) d += `M${pt(start, 0)}L${pt(start - h, h)}`;
  return { w, h, paths: [{ d, stroke: "currentColor", width: 1.5 }] };
}

/** Thin rays in a band across the top of a page, as light falls through a high window. */
export function pinstripes(w: number, h: number, gap: number): Art {
  let d = "";
  for (let x = gap / 2; x < w; x += gap) d += `M${n(x)},0V${n(h)}`;
  return { w, h, paths: [{ d, stroke: "currentColor", width: 1 }] };
}

/** An oval cartouche: a doubled oval ring with a lozenge at each end, to frame a portrait or a monogram. */
export function cartouche(): Art {
  const ring = (rx: number, ry: number) => `M${pt(150 - rx, 200)}a${n(rx)},${n(ry)} 0 1,0 ${n(rx * 2)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-rx * 2)},0Z`;
  return {
    w: 300,
    h: 400,
    paths: [
      { d: ring(132, 182) + ring(120, 170), stroke: "currentColor", width: 3 },
      { d: lozenge(150, 12, 18, 22) + lozenge(150, 388, 18, 22) + circle(16, 200, 5) + circle(284, 200, 5), fill: "currentColor" },
    ],
  };
}

/** A pair of Art Deco wings: stacked feathers swept out to either side of a centre line, for a badge. */
export function decoWings(): Art {
  let d = "";
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const y = 20 + i * 16;
      const reach = 170 - i * 26;
      d += `M${pt(200 + side * 14, y)}L${pt(200 + side * reach, y + 6)}L${pt(200 + side * (reach - 18), y + 12)}L${pt(200 + side * 14, y + 12)}Z`;
    }
  }
  return { w: 400, h: 110, paths: [{ d: d + lozenge(200, 50, 22, 70), fill: "currentColor" }] };
}

/** Rings round the centre of a 400 box, each a radius and a width, for the hairlines round a cameo. */
export function rings(...list: Array<[radius: number, width: number]>): Art {
  return { w: 400, h: 400, paths: list.map(([r, width]) => ({ d: circle(200, 200, r), stroke: "currentColor", width })) };
}

/** A rectangle from corner to corner as path data, its corners cut in as quarter circles, stepped, or left square. */
function framePath(x0: number, y0: number, x1: number, y1: number, corner: "round" | "step" | "square", c: number): string {
  if (corner === "square" || c <= 0) return `M${pt(x0, y0)}H${n(x1)}V${n(y1)}H${n(x0)}Z`;
  if (corner === "step") return `M${pt(x0 + c, y0)}H${n(x1 - c)}V${n(y0 + c)}H${n(x1)}V${n(y1 - c)}H${n(x1 - c)}V${n(y1)}H${n(x0 + c)}V${n(y1 - c)}H${n(x0)}V${n(y0 + c)}H${n(x0 + c)}Z`;
  const arc = (x: number, y: number) => `A${n(c)},${n(c)} 0 0,0 ${pt(x, y)}`;
  return `M${pt(x0 + c, y0)}H${n(x1 - c)}${arc(x1, y0 + c)}V${n(y1 - c)}${arc(x1 - c, y1)}H${n(x0 + c)}${arc(x0, y1 - c)}V${n(y0 + c)}${arc(x0 + c, y0)}Z`;
}

export interface BorderStyle {
  /** How far inside the outer rule the inner one runs; 0 draws the outer rule alone. */
  gap?: number;
  outer?: number;
  inner?: number;
  corner?: "round" | "step" | "square";
  /** How deep each corner is cut. */
  cut?: number;
  /** A lozenge in the middle of the top and bottom rules, or one inside each corner. */
  jewels?: "sides" | "corners";
}

/** A ruled border round a `w` by `h` box, drawn in the box's own pixels so its rules stay hairlines at any shape. */
export function border(w: number, h: number, style: BorderStyle = {}): Art {
  const { gap = 10, outer = 2, inner = 1, corner = "square", cut = 0, jewels } = style;
  const o = outer / 2;
  const paths: Paths = [{ d: framePath(o, o, w - o, h - o, corner, cut), stroke: "currentColor", width: outer }];
  if (gap > 0) paths.push({ d: framePath(gap, gap, w - gap, h - gap, corner, Math.max(0, cut - gap * 0.5)), stroke: "currentColor", width: inner });
  const j = Math.max(10, gap * 1.4);
  if (jewels === "sides") paths.push({ d: lozenge(w / 2, o, j * 1.6, j) + lozenge(w / 2, h - o, j * 1.6, j), fill: "currentColor" });
  if (jewels === "corners") {
    const at = gap + Math.max(cut - gap * 0.5, 0) + j * 0.9;
    paths.push({ d: lozenge(at, at, j, j) + lozenge(w - at, at, j, j) + lozenge(at, h - at, j, j) + lozenge(w - at, h - at, j, j), fill: "currentColor" });
  }
  return { w, h, paths };
}

/** A proscenium: two arches one inside the other over a `w` by `h` box, a keystone at the crown of the outer one. */
export function archBorder(w: number, h: number, gap = 12, width = 2): Art {
  const arch = (i: number) => {
    const rx = w / 2 - i;
    const ry = Math.min(rx, h * 0.36) - i * 0.4;
    const spring = i + ry;
    return `M${pt(i, h - i)}V${n(spring)}A${n(rx)},${n(ry)} 0 0,1 ${pt(w - i, spring)}V${n(h - i)}Z`;
  };
  const o = width / 2;
  return {
    w,
    h,
    paths: [
      { d: arch(o), stroke: "currentColor", width },
      { d: arch(gap), stroke: "currentColor", width: width / 2 },
      { d: lozenge(w / 2, o, 22, 30), fill: "currentColor" },
    ],
  };
}

/** A smooth path through points, each bend eased the way a hand would draw it. */
function smooth(points: Array<[number, number]>): string {
  let d = `M${pt(...points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    d += `C${pt(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6)} ${pt(x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6)} ${pt(x2, y2)}`;
  }
  return d;
}

/** Veins of marble across a `w` by `h` box: a few long wandering lines of different weights, and fine ones off them. */
export function marbleVeins(w: number, h: number, seed = 11): Art {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const paths: Paths = [];
  for (let vein = 0; vein < 6; vein++) {
    const points: Array<[number, number]> = [];
    let y = h * (0.08 + random() * 0.84);
    const slope = (random() - 0.5) * 0.9;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      points.push([(w * i) / steps, y]);
      y += (w / steps) * slope + (random() - 0.5) * h * 0.06;
    }
    paths.push({ d: smooth(points), stroke: "currentColor", width: vein < 2 ? 2.4 : 0.6 + random() * 1.2 });
    // A fine branch leaving the vein and dying away a little way along.
    const from = 2 + Math.floor(random() * 7);
    const branch: Array<[number, number]> = [points[from]];
    for (let i = 1; i <= 4; i++) branch.push([points[from][0] + (i * w) / 18, points[from][1] + (random() - 0.3) * h * 0.05 * i]);
    paths.push({ d: smooth(branch), stroke: "currentColor", width: 0.6 });
  }
  return { w, h, paths };
}

/** The gilt bands across a bound book's spine, `w` wide: double rules above and below a chain of lozenges and dots. */
export function spineBand(w: number): Art {
  const h = 64;
  const rules = `M0,3H${n(w)}M0,12H${n(w)}M0,52H${n(w)}M0,61H${n(w)}`;
  let chain = "";
  const step = 44;
  const count = Math.floor(w / step);
  const start = (w - (count - 1) * step) / 2;
  for (let i = 0; i < count; i++) {
    const x = start + i * step;
    chain += lozenge(x, 32, 22, 22);
    if (i < count - 1) chain += circle(x + step / 2, 32, 3);
  }
  return { w, h, paths: [{ d: rules, stroke: "currentColor", width: 2 }, { d: chain, fill: "currentColor" }] };
}

/** The printer's ivy leaf: a full heart-shaped leaf pointing right, a vein down its middle, and its stem curling away
 *  to the left. */
export function hedera(): Art {
  const shape = `M136,40C116,22 104,4 80,4C60,4 48,18 50,30C51,35 54,38 58,40C54,42 51,45 50,50C48,62 60,76 80,76C104,76 116,58 136,40Z`;
  const vein = `M60,40C84,40 104,40 126,40`;
  const stem = `M52,40C38,40 26,46 16,38C6,30 10,16 22,16C32,16 34,26 26,30`;
  return {
    w: 140,
    h: 80,
    paths: [
      { d: shape, fill: "currentColor" },
      { d: vein, stroke: "rgba(255,255,255,0.35)", width: 2.5 },
      { d: stem, stroke: "currentColor", width: 4.5 },
    ],
  };
}

/** A rule that swells from fine points to a lozenge in the middle, the way an engraver finishes a line. */
export function taperedRule(): Art {
  const swell = `M20,12Q150,9.5 272,12Q150,14.5 20,12ZM580,12Q450,9.5 328,12Q450,14.5 580,12Z`;
  return { w: 600, h: 24, paths: [{ d: swell + lozenge(300, 12, 30, 20) + circle(284, 12, 2.5) + circle(316, 12, 2.5), fill: "currentColor" }] };
}
