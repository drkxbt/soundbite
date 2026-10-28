import type { Word } from "@drkxbt/audiogram";

export type Span = [number, number];

/** The stretches of a recording transcribed so far, kept in order and merged where they touch. */
export class Coverage {
  spans: Span[] = [];

  add(start: number, end: number): void {
    if (end <= start) return;
    const all = [...this.spans, [start, end] as Span].sort((a, b) => a[0] - b[0]);
    const merged: Span[] = [];
    for (const [from, to] of all) {
      const last = merged.at(-1);
      if (last && from <= last[1] + 1e-6) last[1] = Math.max(last[1], to);
      else merged.push([from, to]);
    }
    this.spans = merged;
  }

  /** How many seconds are transcribed. */
  covered(): number {
    return this.spans.reduce((sum, [from, to]) => sum + to - from, 0);
  }

  has(start: number, end: number): boolean {
    return this.spans.some(([from, to]) => from <= start + 1e-6 && to >= end - 1e-6);
  }

  /** The first moment at or after `time` that isn't transcribed. */
  private gapFrom(time: number): number {
    for (const [from, to] of this.spans) if (from <= time + 1e-6 && to > time) time = to;
    return time;
  }

  /**
   * The next stretch to transcribe, up to `length` seconds: the first gap inside `focus`, the stretches the user is
   * looking at, in their order, started up to `lead` seconds early so a sentence running into it is heard whole; else
   * the first gap from the start. It stops where transcribed audio begins. Null once the whole recording is done.
   */
  next(duration: number, focus: Span[], length = 120, lead = 0): Span | null {
    let start: number | null = null;
    for (const [from, to] of focus) {
      const gap = this.gapFrom(Math.max(0, from));
      if (gap < Math.min(to, duration) - 1e-6) {
        const before = this.spans.filter(([, end]) => end <= gap + 1e-6).at(-1)?.[1] ?? 0;
        start = Math.max(before, gap - lead);
        break;
      }
    }
    start ??= this.gapFrom(0);
    if (start >= duration - 1e-6) return null;
    const covered = this.spans.find(([from]) => from > start! + 1e-6)?.[0] ?? Infinity;
    return [start, Math.min(start + length, duration, covered)];
  }
}

/**
 * Where a transcribed stretch should end, so the next one starts at a natural break: after the last sentence that ends
 * in its second half, else in the middle of the longest pause in its last third, else at its own end. A stretch that
 * isn't `open`, because it runs into transcribed audio or to the end of the recording, keeps its end.
 */
export function cutPoint(words: Word[], [start, end]: Span, open: boolean): number {
  if (!open || !words.length) return end;
  const half = start + (end - start) / 2;
  const sentence = words.findLast((word) => word.end >= half && word.end < end && /[.?!…]["')\]]*$/.test(word.text));
  if (sentence) return sentence.end;
  const third = start + ((end - start) * 2) / 3;
  let best: { gap: number; at: number } | null = null;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (words[i - 1].end >= third && words[i].start < end && (!best || gap > best.gap)) best = { gap, at: (words[i - 1].end + words[i].start) / 2 };
  }
  return best && best.gap > 0.2 ? best.at : end;
}
