import type { Cue, Word } from "@drkxbt/audiogram";

/** One piece of Whisper's word-level output: the word, and where it starts and ends in the transcribed audio. */
export interface Chunk {
  text: string;
  timestamp: [number, number | null];
}

// Whisper times words to a fiftieth of a second; milliseconds keep the sums from drifting.
const ms = (seconds: number) => Math.round(seconds * 1000) / 1000;

/**
 * Whisper's chunks as words in recording time: `offset` is where the transcribed audio starts in the recording and
 * `length` how long it lasts, since Whisper can stretch the last word to the end of its 30 second window.
 */
export function toWords(chunks: Chunk[], offset: number, length = Infinity): Word[] {
  // A word Whisper places after the audio ends was never said in it.
  const spoken = chunks
    .map((chunk) => ({ text: chunk.text.trim(), start: chunk.timestamp[0], end: chunk.timestamp[1] }))
    .filter((chunk) => chunk.text && chunk.start < length);
  return spoken.map((chunk, index) => {
    // The last word of a window can come back with no end; it lasts until the next word, or a short beat.
    const end = Math.min(chunk.end ?? spoken[index + 1]?.start ?? chunk.start + 0.3, length);
    return { text: chunk.text, start: ms(chunk.start + offset), end: ms(end + offset) };
  });
}

/**
 * Words grouped into captions. A caption ends at a sentence's end, before a pause longer than `maxGap` seconds, or
 * before it would run past `maxChars`. The limit is loose because Audiogram breaks a long caption into pages that fit
 * the video's shape; here it only keeps the list of captions easy to edit, without stranding a sentence's last word.
 */
export function wordsToCues(words: Word[], { maxChars = 84, maxGap = 0.8 } = {}): Cue[] {
  const cues: Cue[] = [];
  let group: Word[] = [];
  const close = () => {
    if (!group.length) return;
    cues.push({ start: group[0].start, end: group.at(-1)!.end, text: group.map((word) => word.text).join(" "), words: group });
    group = [];
  };
  for (const word of words) {
    const last = group.at(-1);
    const length = group.reduce((sum, item) => sum + item.text.length + 1, word.text.length);
    if (last && (word.start - last.end > maxGap || length > maxChars)) close();
    group.push({ ...word });
    if (/[.?!]$/.test(word.text)) close();
  }
  close();
  return cues;
}

// A line reduced to lower-case letters, digits, apostrophes and single spaces, in any script.
const plain = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, "").replace(/\s+/g, " ").trim();

// What Whisper tends to write over silence or music, learnt from the end credits and subtitle credits of the videos
// it was trained on. The model is multilingual and guesses the language, so the stock lines come in several.
const STOCK = new Set([
  "you", "thank you", "thanks", "thank you for watching", "thanks for watching", "thank you so much",
  "ご視聴ありがとうございました", "продолжение следует", "hãy đăng ký kênh để ủng hộ kênh của mình nhé",
  "gracias por ver", "obrigado por assistir", "vielen dank fürs zuschauen", "merci d'avoir regardé", "시청해주셔서 감사합니다",
].map(plain));
// Subtitle credits Whisper repeats whole, whatever surrounds them.
const CREDITS = ["amaraorg", "subtitles by", "untertitel im auftrag", "soustitres"];

/**
 * True when the words are no real speech: nothing at all, no letters in any script, a stock phrase alone, a
 * subtitle credit, or one word stuck on repeat.
 */
export function isHallucination(words: Word[]): boolean {
  if (!words.length) return true;
  const line = plain(words.map((word) => word.text).join(" "));
  if (!/\p{L}/u.test(line) || STOCK.has(line) || CREDITS.some((credit) => line.includes(credit))) return true;
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    run = words[i].text.toLowerCase() === words[i - 1].text.toLowerCase() ? run + 1 : 1;
    if (run > 5) return true;
  }
  return false;
}

/** The captions after transcribing `range`: the fresh ones in place of any that touched it, in time order. */
export function mergeCues(existing: Cue[], fresh: Cue[], [start, end]: [number, number]): Cue[] {
  const kept = existing.filter((cue) => cue.end <= start || cue.start >= end);
  return [...kept, ...fresh].sort((a, b) => a.start - b.start);
}
