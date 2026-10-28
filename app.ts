import { audiogram, type Editor, type Settings } from "@drkxbt/audiogram";
import { decode, rangeSamples } from "./audio.js";
import { watchAd } from "./ads.js";
import { config, type Config } from "./config.js";
import { credit } from "./credit.js";
import { isHallucination, mergeCues, wordsToCues } from "./cues.js";
import { loadKit, saveKit, shrinkCover, type Kit } from "./kit.js";
import { showThanks } from "./panel.js";
import { createTranscriber, type Progress } from "./transcribe.js";

const ICONS = {
  transcribe: '<path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
  stop: '<rect class="fill" x="7" y="7" width="10" height="10" rx="1.5"/>',
  credit: '<path d="M4 5.5h16v13H4z"/><path d="M13 8.5h4.5M15.5 8.5v.01"/><path d="m8 15 2.5-2.5L13 15"/>',
};

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function keyButton(className: string, label: string, icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ag-btn ${className}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = svg(icon);
  return button;
}

function relabel(button: HTMLButtonElement, label: string, icon: string) {
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = svg(icon);
}

export interface SoundbiteOptions extends Partial<Config> {
  /** Transcribe the picked part as soon as a recording opens. On by default; the recording tour turns it off. */
  autoTranscribe?: boolean;
}

export interface Soundbite {
  readonly editor: Editor;
  destroy(): void;
}

/**
 * Soundbite in `container`: the Audiogram editor with a bar above it that transcribes the picked part on this
 * device and takes the corner credit off for one download after a rewarded ad. Downloads end with the follow and
 * star panel.
 */
export function soundbite(container: HTMLElement, { autoTranscribe = true, ...options }: SoundbiteOptions = {}): Soundbite {
  const settings: Config = { ...config, ...options };
  const root = document.createElement("div");
  root.className = "sb";

  const bar = document.createElement("div");
  bar.className = "sb-bar";
  const transcribeKey = keyButton("sb-transcribe", "Transcribe this part", ICONS.transcribe);
  const meter = document.createElement("div");
  meter.className = "sb-meter";
  meter.setAttribute("aria-hidden", "true");
  const status = document.createElement("p");
  status.className = "sb-status";
  status.setAttribute("role", "status");
  const creditKey = keyButton("sb-credit", "Watch a short ad to remove the credit", ICONS.credit);
  const creditNote = document.createElement("p");
  creditNote.className = "sb-credit-note";
  creditNote.setAttribute("role", "status");
  const work = document.createElement("div");
  work.className = "sb-transcript";
  work.append(transcribeKey, status, meter);
  const clean = document.createElement("div");
  clean.className = "sb-clean";
  clean.append(creditNote, creditKey);
  bar.append(work, clean);

  const stage = document.createElement("div");
  stage.className = "sb-editor";
  root.append(bar, stage);
  container.append(root);

  const say = (text: string, tone: "" | "busy" | "done" | "warn" = "") => {
    status.textContent = text;
    root.dataset.tone = tone;
  };
  const setMeter = (percent: number | null) => {
    root.toggleAttribute("data-working", percent !== null);
    meter.style.setProperty("--done", String((percent ?? 0) / 100));
  };

  // The kit the user left last time fills the editor in; the picture comes back as the data URL it was kept as.
  const kit = loadKit();
  let creditOn = true;
  let savedTimer = 0;
  const shrunk = new WeakMap<Blob, Promise<string>>();

  async function keep(next: Settings) {
    const entry: Kit = { title: next.title, speaker: next.speaker, handle: next.handle, layout: next.layout, visual: next.visual };
    if (typeof next.theme === "number") entry.theme = next.theme;
    if (next.cover instanceof Blob) {
      if (!shrunk.has(next.cover)) shrunk.set(next.cover, shrinkCover(next.cover));
      entry.cover = await shrunk.get(next.cover)!.catch(() => undefined);
    } else if (typeof next.cover === "string" && next.cover.startsWith("data:image/")) entry.cover = next.cover;
    saveKit(entry);
  }

  const editor = audiogram(stage, {
    ...kit,
    overlay: credit,
    onChange: (next) => {
      clearTimeout(savedTimer);
      savedTimer = window.setTimeout(() => void keep(next), 500);
    },
    onExport: ({ blob, extension }) => {
      const link = document.createElement("a");
      const now = new Date();
      const two = (n: number) => String(n).padStart(2, "0");
      // Local time, so the name matches the clock of whoever made it.
      const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
      link.href = URL.createObjectURL(blob);
      link.download = `soundbite-${stamp}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
      // A watched ad buys one clean download; the next clip carries the credit again.
      if (!creditOn) setCredit(true);
      showThanks(root, settings);
    },
  });

  // Transcription.

  let busy = false;
  let decoded: { source: string | Blob; buffer: Promise<AudioBuffer> } | null = null;
  const transcriber = createTranscriber({
    onProgress: ({ stage: step, percent }: Progress) => {
      setMeter(percent);
      say(step === "download" ? `Getting the speech model, ${percent}%. Only the first time.` : `Listening, ${percent}%`, "busy");
    },
  });

  const ready = () => editor.element.dataset.state === "ready";
  // What the bar says when nothing is running: only what is true of the picked part right now.
  const idle = () => {
    const [start, end] = editor.range;
    const part = `${clock(start)} to ${clock(end)}`;
    if (!ready()) say("Open a recording, then pick the part to share");
    else if (editor.captions.some((cue) => cue.end > start && cue.start < end)) say(`Captions for ${part}. Fix any word in the list on the right`, "done");
    else say(`No captions yet for ${part}`);
  };

  async function transcribe() {
    if (busy) {
      transcriber.cancel();
      return;
    }
    const source = editor.source;
    if (!source || !ready()) return idle();
    busy = true;
    relabel(transcribeKey, "Stop transcribing", ICONS.stop);
    setMeter(0);
    say("Reading the recording", "busy");
    try {
      if (decoded?.source !== source) {
        const blob = typeof source === "string" ? fetch(source).then((response) => response.blob()) : Promise.resolve(source);
        decoded = { source, buffer: blob.then(decode) };
      }
      const [start, end] = editor.range;
      const words = await transcriber.transcribe(rangeSamples(await decoded.buffer, start, end), start);
      if (isHallucination(words)) say("No speech found in this part", "warn");
      else {
        editor.setCaptions(mergeCues(editor.captions, wordsToCues(words), [start, end]));
        say("Captions in. Fix any word in the list on the right", "done");
      }
    } catch (error) {
      const name = (error as Error).name;
      if (name === "AbortError") idle();
      else if (name === "DownloadError") say("Couldn't download the speech model. Check your connection and try again", "warn");
      else say("Couldn't transcribe this part. Try again, or a shorter part", "warn");
      if (name !== "DownloadError" && name !== "AbortError") decoded = null;
    } finally {
      busy = false;
      relabel(transcribeKey, "Transcribe this part", ICONS.transcribe);
      setMeter(null);
    }
  }

  // The credit.

  function setCredit(on: boolean) {
    creditOn = on;
    editor.setOverlay(on ? credit : null);
    root.toggleAttribute("data-clean", !on);
    creditKey.disabled = !on;
    creditNote.textContent = on ? "Clips carry a small made-with credit" : "Your next download has no credit";
  }

  async function removeCredit() {
    creditKey.disabled = true;
    creditNote.textContent = "Loading a short ad";
    const result = await watchAd(settings.adUnit);
    if (result === "granted") return setCredit(false);
    setCredit(true);
    creditNote.textContent = result === "closed"
      ? "The ad closed early, so the credit stays"
      : "Couldn't load an ad, so the credit stays. An ad blocker can stop it";
  }

  transcribeKey.addEventListener("click", () => void transcribe());
  creditKey.addEventListener("click", () => void removeCredit());

  // The bar follows the editor: what can be transcribed changes as a recording loads and the range moves.
  // A recording that has just opened is transcribed straight away, once; the key does it again for another part.
  let transcribed: string | Blob | null = null;
  const watcher = new MutationObserver(() => {
    transcribeKey.disabled = !ready() && !busy;
    if (!busy && root.dataset.tone !== "warn") idle();
    if (autoTranscribe && ready() && !busy && editor.source && editor.source !== transcribed) {
      transcribed = editor.source;
      void transcribe();
    }
  });
  watcher.observe(editor.element, { attributes: true, attributeFilter: ["data-state"] });
  editor.element.addEventListener("pointerup", () => !busy && root.dataset.tone !== "warn" && idle());
  editor.element.addEventListener("keyup", () => !busy && root.dataset.tone !== "warn" && idle());
  transcribeKey.disabled = !ready();
  setCredit(true);
  idle();

  return {
    editor,
    destroy() {
      transcriber.cancel();
      watcher.disconnect();
      editor.destroy();
      root.remove();
    },
  };
}
