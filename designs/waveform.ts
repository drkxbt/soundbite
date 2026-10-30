import type { Art } from "@drkxbt/audiogram";
import { area, avatarAt, captions, column, GROTESK, heading, icon, INK, INTER, label, MONO, QUIET, row, space, stack, template, tenth, WHITE, type Block, type Style } from "../template-kit.js";

const GROUND = "#07080c";
// Signal lime for the sound and the word being said, with a cool violet as the second light in the silk behind.
const SIGNAL = "#c6ff3d";
const VIOLET = "#6c5cff";

/** Tick marks along a run `w` long: a tall one every `every` ticks, short ones between, as a timeline ruler has. */
function ruler(w: number, h: number, count: number, every: number): Art {
  const step = w / count;
  let major = "";
  let minor = "";
  for (let i = 0; i <= count; i++) {
    const x = tenth(Math.min(w - 0.75, Math.max(0.75, i * step)));
    if (i % every === 0) major += `M${x} 0v${tenth(h)}`;
    else minor += `M${x} ${tenth(h * 0.45)}v${tenth(h * 0.55)}`;
  }
  return { w: tenth(w), h: tenth(h), paths: [{ d: major, stroke: "currentColor", width: 1.5 }, { d: minor, stroke: "currentColor", width: 1.5, opacity: 0.55 }] };
}

/** Small square points `gap` apart over a `w` by `h` box, a scope screen's graticule, a row of them to a path so no
 *  one path runs longer than a saved kit keeps. */
function graticule(w: number, h: number, gap: number, side: number): Art {
  const paths: Art["paths"] = [];
  for (let y = gap / 2; y < h; y += gap) {
    let d = "";
    for (let x = gap / 2; x < w; x += gap) d += `M${tenth(x - side / 2)} ${tenth(y - side / 2)}h${side}v${side}h${-side}z`;
    paths.push({ d, fill: "currentColor" });
  }
  return { w: tenth(w), h: tenth(h), paths };
}

/** Four corner brackets round a `w` by `h` box, the marks a scope's screen is framed with. */
function brackets(w: number, h: number, arm: number, width: number): Art {
  const i = width / 2;
  const [l, t, r, b] = [i, i, tenth(w - i), tenth(h - i)];
  const d = `M${l} ${arm}V${t}H${arm}M${tenth(w - arm)} ${t}H${r}V${arm}M${r} ${tenth(h - arm)}V${b}H${tenth(w - arm)}M${arm} ${b}H${l}V${tenth(h - arm)}`;
  return { w: tenth(w), h: tenth(h), paths: [{ d, stroke: "currentColor", width }] };
}

/** A thin circle the size of its box, to ring the speaker's photo. */
function halo(d: number, width: number): Art {
  const r = (d - width) / 2;
  return { w: d, h: d, paths: [{ d: `M${width / 2} ${d / 2}a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(r * 2)} 0a${tenth(r)} ${tenth(r)} 0 1 0 ${tenth(-r * 2)} 0`, stroke: "currentColor", width }] };
}

/**
 * The sound is the picture: a wave as wide as the frame, scrolling the last seconds of the voice, framed like a scope
 * on a faint dot grid with a ruler under it and the time played and left at its two ends. Silk waves drift behind and
 * swell with the voice; the captions sit above the wave, the speaker and the episode along the top.
 */
export const waveform = template("waveform", "Waveform", { color: GROUND }, INK, (f) => {
  const name: Style = { font: INTER, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 30 }), weight: 700, color: WHITE, enter: "slide", direction: "right", from: 0.1 };
  const handle: Style = { font: INTER, size: 26, weight: 500, color: WHITE, opacity: QUIET, enter: "slide", direction: "right", from: 0.2 };
  const tag: Style = { font: MONO, size: 26, weight: 700, color: WHITE, uppercase: true, letterSpacing: 120, opacity: 0.9, enter: "fade", from: 0.35 };
  const title: Style = { font: GROTESK, size: f.by({ square: 50, portrait: 54, story: 54, landscape: 50 }), weight: 700, color: WHITE, lineHeight: 1.12, letterSpacing: -12, enter: "blur", from: 0.25 };
  const words: Style = { font: INTER, size: f.by({ square: 64, portrait: 72, story: 80, landscape: 64 }), weight: 700, color: WHITE, highlight: SIGNAL, lineHeight: 1.28, letterSpacing: -8 };
  const time: Style = { font: MONO, size: f.by({ square: 30, portrait: 30, story: 34, landscape: 30 }), weight: 700, color: SIGNAL, letterSpacing: 40 };
  const small: Style = { font: MONO, size: 26, weight: 400, color: WHITE, opacity: QUIET, uppercase: true, letterSpacing: 140 };

  const a = area(f);
  const c = column(a.left, a.right);
  const screenH = f.px(f.by({ square: 220, portrait: 290, story: 360, landscape: 240 }));
  const rulerH = f.px(20);
  const timeH = f.lines(time.size!, 1, 1.2);
  const scopeH = screenH + f.px(22) + rulerH + f.px(14) + timeH;

  // The silk ribbons run through the lower part of their box, so the box is set to put them right behind the wave and
  // leave the words above on plain ground. The wave block is the last in the stack, so it ends at the area's foot.
  const waveMid = a.bottom - scopeH + screenH / 2;
  const silkH = Math.min(f.height, (f.height - waveMid) / 0.41);
  f.add("ambient", "silk", 0, f.height - silkH, f.width, silkH, { ambient: "waves", fill: GROUND, color: VIOLET, highlight: SIGNAL, pace: 0.8, react: true });

  /** The speaker's photo in a pulsing halo, their name and handle beside it, and the episode at the far right behind a
   *  lime light that blinks like a recorder's. */
  const top = (d: number): Block => {
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const h = Math.max(f.px(d), nameH + handleH);
    return {
      h,
      gap: 0,
      draw: (y) => {
        const cx = c.x + f.px(d) / 2;
        const cy = y + h / 2;
        const ring = f.px(d + 22);
        f.add("graphic", "halo", cx - ring / 2, cy - ring / 2, ring, ring, { art: halo(tenth(ring), 2), color: SIGNAL, opacity: 0.7, enter: "zoom", loop: "pulse" });
        avatarAt(f, cx, cy, d, { fill: "#1b1d27", ink: SIGNAL }, { enter: "pop" });
        const x = c.x + f.px(d + 26);
        const line = y + (h - nameH - handleH) / 2;
        f.add("name", "main", x, line, f.px(520), nameH, { align: "left", ...name });
        f.add("handle", "main", x, line + nameH, f.px(520), handleH, { align: "left", ...handle });
        const tagH = f.lines(tag.size!, 1, 1);
        label(f, "episode", "Ep. 00", c.x + c.w, cy - tagH / 2, { ...tag, align: "right" }, 0.6);
        const dot = f.px(14);
        const tagW = f.px(tag.size! * 6 * (0.6 + 0.12));
        f.add("shape", "rec", c.x + c.w - tagW - f.px(18) - dot, cy - dot / 2, dot, dot, { shape: "ellipse", fill: SIGNAL, loop: "flash" });
      },
    };
  };

  /** The wave across the frame, wider than the words' column, on its scope grid, with the ruler and the clocks under it. */
  const scope = (gap: number): Block => ({
    h: scopeH,
    gap: f.px(gap),
    draw: (y) => {
      const x = f.pad * 0.45;
      const w = f.width - x * 2;
      const mid = y + screenH / 2;
      f.add("graphic", "grid", x, y, w, screenH, { art: graticule(tenth(w), tenth(screenH), 28, 3), color: WHITE, opacity: 0.12, enter: "fade" });
      f.add("graphic", "frame", x, y, w, screenH, { art: brackets(tenth(w), tenth(screenH), 28, 2), color: WHITE, opacity: 0.5, enter: "zoom", from: 0.1 });
      f.add("shape", "axis", x + f.px(20), mid - f.px(4), w - f.px(40), f.px(8), { shape: "line", fill: SIGNAL, strokeWidth: 1.5, opacity: 0.4, enter: "wipe", direction: "right" });
      // A faint spectrum line behind the wave, in the violet of the silk, so the screen carries two traces as a scope does.
      f.add("visual", "trace", x + f.px(20), y + f.px(10), w - f.px(40), screenH - f.px(20), { visual: "line", color: VIOLET, opacity: 0.7, keepLook: true, enter: "fade", from: 0.2 });
      f.add("visual", "main", x + f.px(20), y + f.px(10), w - f.px(40), screenH - f.px(20), { visual: "wave", color: SIGNAL, enter: "wipe", direction: "right" });
      const ry = y + screenH + f.px(22);
      f.add("graphic", "ruler", c.x, ry, c.w, rulerH, { art: ruler(tenth(c.w), tenth(rulerH), f.wide ? 80 : 48, 8), color: WHITE, opacity: 0.45, enter: "wipe", direction: "right", from: 0.15 });
      const ty = ry + rulerH + f.px(14);
      const glyph = f.px(26);
      icon(f, "play", "play", c.x, ty + (timeH - glyph) / 2, 26, SIGNAL, 1, { enter: "rise", from: 0.4 });
      f.add("time", "elapsed", c.x + glyph + f.px(12), ty, f.px(150), timeH, { ...time, align: "left", clock: "elapsed", enter: "rise", from: 0.45 });
      f.add("time", "remaining", c.x + c.w - f.px(150), ty, f.px(150), timeH, { ...time, align: "right", clock: "remaining", enter: "rise", from: 0.5 });
      const labelH = f.lines(small.size!, 1, 1);
      label(f, "played", "Played", c.x + glyph + f.px(132), ty + (timeH - labelH) / 2, { ...small, enter: "fade", from: 0.6 }, 0.6);
      label(f, "left", "Left", c.x + c.w - f.px(124), ty + (timeH - labelH) / 2, { ...small, align: "right", enter: "fade", from: 0.65 }, 0.6);
    },
  });

  stack(a.top, a.bottom, [
    top(f.by({ square: 76, portrait: 84, story: 96, landscape: 76 })),
    row(f, 8, f.by({ square: 24, portrait: 28, story: 36, landscape: 22 }), (y, h) => f.add("shape", "rule", c.x, y, c.w, h, { shape: "line", fill: WHITE, strokeWidth: 1.5, opacity: 0.16, enter: "wipe", direction: "right", from: 0.05 })),
    heading(f, f.wide ? column(c.x, c.x + f.px(1300)) : c, title, 2, f.by({ square: 22, portrait: 28, story: 36, landscape: 20 })),
    space(f.by({ square: 0.4, portrait: 0.6, story: 1, landscape: 0.4 })),
    captions(f, f.wide ? column(c.x, c.x + f.px(1500)) : c, words, f.by({ square: 3, portrait: 3, story: 4, landscape: 3 }), 24),
    space(f.by({ square: 0.6, portrait: 0.4, story: 0.5, landscape: 0.6 })),
    scope(24),
  ]);
});
