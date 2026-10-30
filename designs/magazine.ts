import { area, captions, column, heading, INTER, label, PAPER, QUIET, SERIF, space, stack, template, type Block, type Column, type Portrait, type Style, avatarAt } from "../template-kit.js";

const PAPER_TONE = "#f2eee5";
const INK_TONE = "#171512";
// A press red: deep enough that white reads on it, warm enough to sit on the cream without shouting.
const RED = "#c23a1e";
// The mono cover photo: the condenser microphone, close up.
const COVER = "b878edc4";

/**
 * A magazine spread on cream paper: a masthead over a double rule, a mono cover photo where the shape has room for one,
 * a serif headline typed in, the words set large as a pull quote beside a red quote mark, the sound as a fine line, and
 * the speaker signing off at the foot. Film grain and a slow light leak keep the paper alive.
 */
export const magazine = template("magazine", "Magazine", { color: PAPER_TONE }, PAPER, (f) => {
  const caps = (size: number): Style => ({ font: INTER, size, weight: 600, color: INK_TONE, uppercase: true, letterSpacing: 160 });
  const small = f.by({ square: 26, portrait: 26, story: 28, landscape: 26 });
  const kicker: Style = { ...caps(small), color: RED, enter: "typewriter", from: 0.35, speed: 1.4 };
  const mast: Style = { font: SERIF, size: f.by({ square: 52, portrait: 58, story: 64, landscape: 56 }), weight: 400, italic: true, color: INK_TONE, enter: "fade", speed: 0.8 };
  const title: Style = { font: SERIF, size: f.by({ square: 80, portrait: 80, story: 82, landscape: 80 }), weight: 400, color: INK_TONE, lineHeight: 1.02, letterSpacing: -8, enter: "typewriter", from: 0.55, speed: 1.2 };
  const words: Style = { font: SERIF, size: f.by({ square: 80, portrait: 82, story: 88, landscape: 74 }), weight: 400, color: INK_TONE, highlight: RED, lineHeight: 1.14 };
  const name: Style = { font: INTER, size: f.by({ square: 27, portrait: 28, story: 30, landscape: 28 }), weight: 600, color: INK_TONE, enter: "baseline", from: 1.15 };
  const handle: Style = { font: INTER, size: small, weight: 400, color: INK_TONE, opacity: QUIET, enter: "baseline", from: 1.25 };
  const clock: Style = { font: INTER, size: f.by({ square: 30, portrait: 30, story: 32, landscape: 30 }), weight: 600, color: INK_TONE, clock: "elapsed", align: "right", letterSpacing: 40, enter: "fade", from: 1.3 };
  const portrait: Portrait = { fill: INK_TONE, ink: PAPER_TONE };
  const a = area(f);

  // Film grain with a warm leak of light drifting in from a corner, the paper's own texture.
  f.add("ambient", "paper", 0, 0, f.width, f.height, { ambient: "grain", fill: PAPER_TONE, color: "#e4b98a", highlight: "#ffffff", pace: 0.8 });

  /** A line `weight` design pixels thick across the column, drawn in from the left. */
  const line = (name: string, c: Column, y: number, weight: number, from: number) =>
    f.add("shape", name, c.x, y - f.px(4), c.w, f.px(8), { shape: "line", fill: INK_TONE, strokeWidth: weight, enter: "wipe", from, speed: 0.7 });

  /** The masthead: the show's name in italic serif, the issue in spaced capitals at the right, a double rule under. */
  const masthead = (c: Column): Block => {
    const textH = f.lines(mast.size!, 1, 1);
    return {
      h: textH + f.px(26),
      gap: 0,
      draw: (y) => {
        label(f, "masthead", "Your show", c.x, y, mast, 0.42);
        label(f, "edition", "Audio edition", c.x + c.w / 2, y + textH - f.lines(small, 1, 1) - f.px(4), { ...caps(small), align: "center", enter: "fade", from: 0.2 }, 0.66);
        const issueH = f.lines(small, 1, 1);
        label(f, "issue", "Issue 00", c.x + c.w, y + textH - issueH - f.px(4), { ...caps(small), align: "right", enter: "fade", from: 0.15 }, 0.66);
        line("rule-mast", c, y + textH + f.px(14), 3, 0.1);
        line("rule-mast-fine", c, y + textH + f.px(22), 1, 0.2);
      },
    };
  };

  /** The section's label in red capitals, a hairline running on from it to the column's edge. */
  const section = (c: Column, gap: number): Block => {
    const h = f.lines(small, 1, 1);
    const text = "In conversation";
    return {
      h,
      gap: f.px(gap),
      draw: (y) => {
        label(f, "kicker", text, c.x, y, kicker, 0.7);
        const start = c.x + f.px(small * text.length * 0.86) + f.px(24);
        f.add("shape", "rule", start, y + h / 2 - f.px(4), c.x + c.w - start, f.px(8), { shape: "line", fill: INK_TONE, strokeWidth: 1, enter: "wipe", from: 0.7, speed: 0.7 });
      },
    };
  };

  /** The cover photo in mono, uncovered from the top, then slowly pushing in. */
  const cover = (x: number, y: number, w: number, h: number) => {
    f.add("image", "photo", x, y, w, h, {
      image: `photo:${COVER}`, mask: "rect", filter: "mono", adjust: { contrast: 1.08, brightness: 0.96 }, loop: "slowZoom", enter: "wipe", direction: "down", from: 0.1, speed: 0.6,
    });
  };

  /** The words as a pull quote: a large red quote mark hanging in the margin, the captions set beside it. */
  const quote = (c: Column, count: number, gap: number): Block => {
    const indent = f.px(f.by({ square: 54, portrait: 60, story: 66, landscape: 58 }));
    const body = captions(f, column(c.x + indent, c.x + c.w), words, count, 0);
    return {
      ...body,
      gap: f.px(gap),
      draw: (y, h) => {
        const size = (words.size ?? 60) * 3.4;
        // The serif draws the mark in the top fifth of its letter's box, so the box is cut to that and sits on the
        // first line's cap height.
        f.add("text", "quote", c.x - f.px(size * 0.04), y + f.px(words.size! * 0.08), f.px(size * 0.42), f.px(size * 0.3), {
          text: "“", font: SERIF, size, lineHeight: 1, align: "left", color: RED, autoWidth: true, enter: "rise", from: 0.9,
        });
        body.draw(y, h);
      },
    };
  };

  /** The sound as a fine line across the column, drawn in after the headline. */
  const sound = (c: Column, h: number, gap: number): Block => ({
    h: f.px(h),
    gap: f.px(gap),
    draw: (y, height) => f.add("visual", "main", c.x, y, c.w, height, { visual: "line", color: INK_TONE, enter: "wipe", from: 1.0, speed: 0.8 }),
  });

  /** The speaker signing off: photo, name and handle at the left; a live red dot, "Now playing" and the time at the right. */
  const foot = (c: Column, d: number, gap: number): Block => {
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const h = Math.max(f.px(d), nameH + handleH);
    return {
      h,
      gap: f.px(gap),
      draw: (y) => {
        avatarAt(f, c.x + f.px(d) / 2, y + h / 2, d, portrait, { enter: "pop", from: 1.05 });
        const x = c.x + f.px(d + 22);
        const top = y + (h - nameH - handleH) / 2;
        f.add("name", "main", x, top, f.px(420), nameH, { align: "left", ...name });
        f.add("handle", "main", x, top + nameH, f.px(420), handleH, { align: "left", ...handle });
        const clockH = f.lines(clock.size!, 1, 1.2);
        const right = c.x + c.w;
        const capsH = f.lines(small, 1, 1);
        const stackTop = y + (h - capsH - f.px(10) - clockH) / 2;
        const playing = label(f, "playing", "Now playing", right, stackTop, { ...caps(small), align: "right", enter: "fade", from: 1.2 }, 0.68);
        const dot = f.px(12);
        const textW = f.px(small * "Now playing".length * (0.68 + 0.16));
        f.add("shape", "live", right - textW - f.px(14) - dot, stackTop + (playing - dot) / 2, dot, dot, { shape: "ellipse", fill: RED, loop: "pulse", enter: "pop", from: 1.2 });
        f.add("time", "main", right - f.px(220), stackTop + capsH + f.px(10), f.px(220), clockH, clock);
      },
    };
  };

  const fine = (c: Column, name: string, gap: number, from: number): Block => ({ h: f.px(8), gap: f.px(gap), draw: (y) => line(name, c, y + f.px(4), 1, from) });

  if (f.wide) {
    const full = column(a.left, a.right);
    const left = column(a.left, a.left + f.px(600));
    const right = column(left.x + left.w + f.px(72), a.right);
    const top = a.top + masthead(full).h;
    stack(a.top, top, [masthead(full)]);
    const body = top + f.px(36);
    const foot64 = foot(left, 64, 0);
    const photoH = a.bottom - body - foot64.h - f.px(56);
    cover(left.x, body, left.w, photoH);
    label(f, "figure", "Fig. 01", left.x, body + photoH + f.px(14), { ...caps(small), enter: "fade", from: 0.6 }, 0.66);
    stack(a.bottom - foot64.h, a.bottom, [foot64]);
    // A hairline down the gutter, as a spread is split into columns.
    const gutter = left.x + left.w + f.px(36);
    f.add("shape", "gutter", gutter - f.px(0.75), body, f.px(1.5), a.bottom - body, { shape: "rect", fill: INK_TONE, opacity: 0.85, enter: "wipe", direction: "down", from: 0.3, speed: 0.6 });
    stack(body, a.bottom, [
      section(right, 0),
      heading(f, right, title, 3, 16),
      space(),
      quote(right, 2, 0),
      space(),
      sound(right, 64, 0),
      fine(right, "rule-foot", 14, 1.1),
    ]);
    return;
  }

  const c = column(a.left, a.right);
  const photoH = f.px(f.by({ square: 0, portrait: 230, story: 390, landscape: 0 }));
  stack(a.top, a.bottom, [
    masthead(c),
    photoH > 0 && { h: photoH, gap: f.px(f.by({ square: 0, portrait: 24, story: 32, landscape: 0 })), draw: (y: number) => cover(c.x, y, c.w, photoH) },
    section(c, f.by({ square: 30, portrait: 28, story: 36, landscape: 0 })),
    heading(f, c, title, f.by({ square: 3, portrait: 3, story: 3, landscape: 0 }), f.by({ square: 12, portrait: 14, story: 18, landscape: 0 })),
    // The title's own room already holds the words off it when it runs short, so the quote sits nearer it than the foot.
    space(0.6),
    quote(c, 2, 0),
    space(),
    sound(c, f.by({ square: 54, portrait: 60, story: 72, landscape: 0 }), 0),
    fine(c, "rule-foot", f.by({ square: 10, portrait: 14, story: 18, landscape: 0 }), 1.1),
    foot(c, f.by({ square: 56, portrait: 60, story: 68, landscape: 0 }), f.by({ square: 16, portrait: 20, story: 26, landscape: 0 })),
  ]);
});
