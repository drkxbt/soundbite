import { area, avatarAt, captions, column, glass, heading, INK, label, QUIET, space, stack, template, WHITE, type Block, type Column, type Portrait, type Style } from "../template-kit.js";

const MONO = "JetBrains Mono Variable";
const PAGE = "#040706";
const GREEN = "#3dff9e";
// The green at the strength a dim line of output takes: still 4.5:1 on the window, so it carries words.
const DIM = "#7fcfa4";
const AMBER = "#ffb547";
const RED = "#ff5a52";

/**
 * A developer's terminal: a receding green grid on black behind a smoked glass window. Inside, the speaker is listed
 * by `whoami`, the title flickers in with a split-colour glitch, the words run in an output block with a green gutter
 * and an empty prompt blinking under it, and the sound is a level meter. A tmux-style bar along the foot keeps the time.
 */
export const terminal = template("terminal", "Terminal", { color: PAGE }, INK, (f) => {
  const mono = (size: number, weight = 500): Style => ({ font: MONO, size, weight, color: WHITE });
  const small = f.by({ square: 26, portrait: 26, story: 28, landscape: 26 });
  const prompt: Style = { ...mono(small), color: DIM, enter: "typewriter", speed: 1.6 };
  const title: Style = { ...mono(f.by({ square: 48, portrait: 48, story: 48, landscape: 46 }), 800), lineHeight: 1.18, effect: "glitch", enter: "flicker", from: 0.75 };
  const words: Style = { ...mono(f.by({ square: 52, portrait: 58, story: 64, landscape: 62 }), 600), highlight: GREEN, lineHeight: 1.3 };
  const name: Style = { ...mono(f.by({ square: 28, portrait: 29, story: 31, landscape: 29 }), 700), enter: "fade", from: 0.55 };
  const handle: Style = { ...mono(small), color: GREEN, opacity: QUIET + 0.1, enter: "fade", from: 0.65 };
  const bar: Style = { ...mono(small, 700), color: PAGE };
  const portrait: Portrait = { fill: "#123222", ink: GREEN };
  const a = area(f);
  const inset = f.by({ square: 34, portrait: 38, story: 44, landscape: 40 });

  // The floor of the grid glows green with a cyan haze on its horizon and swells with the voice.
  f.add("ambient", "grid", 0, 0, f.width, f.height, { ambient: "grid", fill: PAGE, color: "#1fd27a", highlight: "#19c6ff", pace: 0.9, react: true });

  /** A line of output in mono from `from`, typed in unless the style picks another way in. */
  const say = (name: string, text: string, x: number, y: number, style: Style, from: number) => label(f, name, text, x, y, { ...style, from }, 0.6);

  /** The window's title bar: three lights, the path in the middle, a pulsing rec light at the right, a hairline under. */
  const chrome = (c: Column): Block => {
    const h = f.lines(small, 1, 1);
    return {
      h: h + f.px(28),
      gap: 0,
      draw: (y) => {
        const dot = f.px(14);
        [RED, AMBER, GREEN].forEach((color, i) => {
          f.add("shape", `light-${i + 1}`, c.x + i * f.px(26), y + (h - dot) / 2, dot, dot, { shape: "ellipse", fill: color, opacity: 0.9, enter: "pop", from: 0.15 + i * 0.08 });
        });
        say("path", "~/your-show/ep-00", c.x + c.w / 2, y, { ...prompt, align: "center", enter: "fade" }, 0.3);
        const rec = say("rec", "rec", c.x + c.w, y, { ...prompt, color: WHITE, align: "right", enter: "fade" }, 0.35);
        const live = f.px(12);
        f.add("shape", "live", c.x + c.w - f.px(small * 3 * 0.6) - f.px(12) - live, y + (rec - live) / 2, live, live, { shape: "ellipse", fill: RED, loop: "pulse", enter: "pop", from: 0.35 });
        f.add("shape", "rule-bar", c.x - f.px(inset), y + h + f.px(18), c.w + f.px(inset * 2), f.px(8), { shape: "line", fill: GREEN, strokeWidth: 1, opacity: 0.4 });
      },
    };
  };

  /** `whoami`, and under it the speaker: photo, name and handle. */
  const whoami = (c: Column, d: number, gap: number): Block => {
    const lineH = f.lines(small, 1, 1);
    const nameH = f.lines(name.size!, 1, 1.3);
    const handleH = f.lines(handle.size!, 1, 1.3);
    const rowH = Math.max(f.px(d), nameH + handleH);
    return {
      h: lineH + f.px(16) + rowH,
      gap: f.px(gap),
      draw: (y) => {
        say("whoami", "$ whoami", c.x, y, prompt, 0.4);
        const top = y + lineH + f.px(16);
        avatarAt(f, c.x + f.px(d) / 2, top + rowH / 2, d, portrait, { enter: "flicker", from: 0.5 });
        const x = c.x + f.px(d + 20);
        const text = top + (rowH - nameH - handleH) / 2;
        f.add("name", "main", x, text, c.x + c.w - x, nameH, { align: "left", ...name });
        f.add("handle", "main", x, text + nameH, c.x + c.w - x, handleH, { align: "left", ...handle });
      },
    };
  };

  /** `cat title.txt` and the title under it. */
  const titled = (c: Column, count: number, gap: number): Block => {
    const lineH = f.lines(small, 1, 1);
    const body = heading(f, c, title, count, 0);
    return {
      h: lineH + f.px(14) + body.h,
      gap: f.px(gap),
      draw: (y) => {
        say("cat", "$ cat title.txt", c.x, y, prompt, 0.6);
        body.draw(y + lineH + f.px(14), body.h);
      },
    };
  };

  /** The words in an output block, as a modern terminal sets a command's output apart: a faint panel with a green
   *  bar down its left edge. Under it an empty prompt waits with a blinking block cursor. */
  const transcript = (c: Column, count: number, gap: number, flex = 0): Block => {
    const size = words.size!;
    const padX = f.px(size * 0.7);
    const padY = f.px(size * 0.4);
    const body = captions(f, column(c.x + padX, c.x + c.w - f.px(size * 0.4)), words, count, 0);
    const lineH = f.lines(small, 1, 1);
    const cursorH = f.px(small * 1.25);
    const tail = lineH + f.px(22);
    return {
      h: body.h + padY * 2 + tail,
      gap: f.px(gap),
      flex,
      draw: (y, h) => {
        const blockH = h - tail;
        f.add("shape", "block", c.x, y, c.w, blockH, { shape: "rect", fill: "#0c1a13", opacity: 0.85, radius: 0.02, stroke: GREEN, strokeWidth: 1, enter: "fade", from: 0.85, speed: 0.6 });
        f.add("shape", "gutter", c.x, y, f.px(5), blockH, { shape: "rect", fill: GREEN, enter: "wipe", direction: "down", from: 0.85, speed: 0.6 });
        say("stream", "stdout", c.x + c.w - f.px(16), y + f.px(14), { ...prompt, align: "right", enter: "fade" }, 1.0);
        body.draw(y + padY, blockH - padY * 2);
        const at = y + blockH + f.px(22);
        const w = say("ready", "$", c.x, at, { ...prompt, color: GREEN, enter: "fade" }, 1.0);
        f.add("shape", "cursor", c.x + f.px(small * 1.2), at + (w - cursorH) / 2, f.px(small * 0.62), cursorH, { shape: "rect", fill: GREEN, loop: "flash", enter: "fade", from: 1.0 });
      },
    };
  };

  /** The sound as a level meter across the column, a scale of decibels in small mono under it. */
  const meter = (c: Column, h: number, gap: number, command = true): Block => {
    const scaleH = f.lines(small, 1, 1);
    const head = command ? scaleH + f.px(14) : 0;
    return {
      h: head + f.px(h) + f.px(10) + scaleH,
      gap: f.px(gap),
      draw: (top) => {
        if (command) say("levels", "$ ./levels --live", c.x, top, prompt, 1.05);
        const y = top + head;
        f.add("visual", "main", c.x, y, c.w, f.px(h), { visual: "blocks", color: GREEN, enter: "wipe", from: 1.1, speed: 0.8 });
        const at = y + f.px(h) + f.px(10);
        say("scale-low", "-60", c.x, at, { ...prompt, enter: "fade" }, 1.3);
        say("scale-mid", "-12", c.x + c.w / 2, at, { ...prompt, align: "center", enter: "fade" }, 1.35);
        say("scale-high", "0 dB", c.x + c.w, at, { ...prompt, align: "right", enter: "fade" }, 1.4);
      },
    };
  };

  /** The status bar along the foot, tmux's: the session at the left, the time played and the share of it at the right. */
  const status = (x: number, y: number, w: number, h: number) => {
    f.add("shape", "bar", x, y, w, h, { shape: "rect", fill: GREEN, radius: 0, enter: "wipe", from: 0.05, speed: 0.7 });
    const textH = f.lines(bar.size!, 1, 1);
    const pad = f.px(20);
    say("session", "[0] podcast*", x + pad, y + (h - textH) / 2, { ...bar, enter: "fade" }, 0.4);
    const clockH = f.lines(bar.size!, 1, 1.2);
    f.add("time", "main", x + w - pad - f.px(160), y + (h - clockH) / 2, f.px(160), clockH, { ...bar, clock: "elapsed", align: "right", enter: "fade", from: 0.45 });
    f.add("time", "share", x + w - pad - f.px(330), y + (h - clockH) / 2, f.px(140), clockH, { ...bar, weight: 500, clock: "percent", align: "right", enter: "fade", from: 0.5 });
  };

  const pane = { tint: "#020403", strength: 0.5, frost: 22, corner: 18, edge: 1.5, shadow: true };
  const barH = f.px(f.by({ square: 52, portrait: 54, story: 60, landscape: 54 }));
  const barGap = f.px(18);
  const winY = a.top;
  const winH = a.bottom - barH - barGap - winY;
  glass(f, "window", a.left, winY, a.w, winH, pane, { stroke: GREEN, strokeWidth: 1.5, enter: "fade", speed: 0.6 });
  status(a.left, a.bottom - barH, a.w, barH);

  const top = winY + f.px(inset * 0.7);
  const bottom = winY + winH - f.px(inset);
  const inner = column(a.left + f.px(inset), a.right - f.px(inset));

  if (f.wide) {
    const head = chrome(inner);
    stack(top, top + head.h, [head]);
    const left = column(inner.x, inner.x + f.px(560));
    const right = column(left.x + left.w + f.px(64), inner.x + inner.w);
    const body = top + head.h + f.px(30);
    f.add("shape", "divider", left.x + left.w + f.px(31), body, f.px(2), bottom - body, { shape: "rect", fill: GREEN, opacity: 0.35, enter: "wipe", direction: "down", from: 0.5 });
    stack(body, bottom, [whoami(left, 72, 0), titled(left, 3, 34), space(), meter(left, 120, 0)]);
    const tail = say("tail", "$ tail -f transcript", right.x, body, prompt, 0.8);
    stack(body + tail, bottom, [transcript(right, 3, 22, 1)]);
    return;
  }
  stack(top, bottom, [
    chrome(inner),
    whoami(inner, f.by({ square: 64, portrait: 72, story: 80, landscape: 0 }), f.by({ square: 20, portrait: 30, story: 40, landscape: 0 })),
    titled(inner, 2, f.by({ square: 22, portrait: 30, story: 40, landscape: 0 })),
    transcript(inner, f.by({ square: 2, portrait: 3, story: 3, landscape: 0 }), f.by({ square: 24, portrait: 34, story: 44, landscape: 0 }), 1),
    // The square has no room for the meter's own command line.
    meter(inner, f.by({ square: 64, portrait: 96, story: 120, landscape: 0 }), f.by({ square: 22, portrait: 30, story: 40, landscape: 0 }), !f.by({ square: true, portrait: false, story: false, landscape: false })),
  ]);
});
