import { audiogram, type Editor, type Settings } from "@drkxbt/audiogram";
import { isSilent, SPEECH_RATE } from "./audio.js";
import { watchAd } from "./ads.js";
import { config, type Config } from "./config.js";
import { credit } from "./credit.js";
import { dropHallucinations, mergeCues, wordsToCues } from "./cues.js";
import { fitPicture, loadKit, saveKit, shrinkCover, type Kit } from "./kit.js";
import { showThanks } from "./panel.js";
import { Coverage, cutPoint, type Span } from "./sweep.js";
import { createTranscriber, type Progress } from "./transcribe.js";

const ICONS = {
  transcribe: '<path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/>',
  pause: '<rect class="fill" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="fill" x="13.5" y="5" width="4" height="14" rx="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  redo: '<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V9h-4.5"/>',
  credit: '<path d="M4 5.5h16v13H4z"/><path d="M13 8.5h4.5M15.5 8.5v.01"/><path d="m8 15 2.5-2.5L13 15"/>',
};

// The recording is transcribed this many seconds at a time, each read with a second of sound either side so no word
// is cut at the join.
const STRETCH = 120;
const PAD = 1;
// The selection's stretch starts this much before it, so a sentence running into the clip is captioned whole.
const LEAD = 10;

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

/** A time as m:ss, or h:mm:ss from an hour. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

/** A button in Audiogram's style with an icon and its name, so it says what it does. */
function key(className: string, text: string, icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ag-key ${className}`;
  relabel(button, text, icon);
  return button;
}

function relabel(button: HTMLButtonElement, text: string, icon: string) {
  button.innerHTML = `${svg(icon)}<span class="ag-key-text"></span>`;
  button.querySelector(".ag-key-text")!.textContent = text;
}

export interface SoundbiteOptions extends Partial<Config> {
  /** Write the captions of a recording as soon as it opens. On by default; the recording tour turns it off. */
  autoTranscribe?: boolean;
}

export interface Soundbite {
  readonly editor: Editor;
  destroy(): void;
}

/**
 * Soundbite in `container`: the Audiogram editor, with a captions key at the top that writes the captions of the whole
 * recording on this device, part by part, and a key by Download that takes the corner credit off for one download
 * after a rewarded ad. Downloads end with the follow and star panel.
 */
export function soundbite(container: HTMLElement, { autoTranscribe = true, ...options }: SoundbiteOptions = {}): Soundbite {
  const settings: Config = { ...config, ...options };
  const root = document.createElement("div");
  root.className = "sb";

  // The captions control: one key that starts, pauses and resumes, and a line beside it that says how far it is.
  const captionsControl = document.createElement("div");
  captionsControl.className = "sb-captions";
  const transcribeKey = key("sb-transcribe", "Auto captions", ICONS.transcribe);
  transcribeKey.title = "Turn the speech into captions on this device";
  const progress = document.createElement("div");
  progress.className = "sb-progress";
  const line = document.createElement("div");
  line.className = "sb-line";
  const status = document.createElement("p");
  status.className = "sb-status";
  status.setAttribute("role", "status");
  // The download's count sits beside the status, out of it, so a screen reader hears the step once, not every percent.
  const percent = document.createElement("span");
  percent.className = "sb-percent";
  percent.setAttribute("aria-hidden", "true");
  line.append(status, percent);
  const meter = document.createElement("span");
  meter.className = "sb-meter";
  meter.setAttribute("aria-hidden", "true");
  progress.append(line, meter);
  captionsControl.append(transcribeKey, progress);
  const redoKey = key("sb-redo", "Redo clip captions", ICONS.redo);
  redoKey.title = "Write this clip's captions again from scratch";

  // Without an ad unit the credit comes off for free, and the key says so. The key also puts the credit back.
  const removeLabel = settings.adUnit ? "Watch a short ad to remove the credit from your next download" : "Remove the credit from your next download";
  const creditWrap = document.createElement("div");
  creditWrap.className = "sb-credit-wrap";
  const creditKey = key("sb-credit", "Remove credit", ICONS.credit);
  // What happened to the credit, shown under its key for a few seconds and read out once.
  const creditNote = document.createElement("p");
  creditNote.className = "sb-credit-note";
  creditNote.setAttribute("role", "status");
  creditWrap.append(creditKey, creditNote);
  let noteTimer = 0;
  const noteCredit = (text: string) => {
    creditNote.textContent = text;
    root.toggleAttribute("data-credit-note", Boolean(text));
    clearTimeout(noteTimer);
    if (text) noteTimer = window.setTimeout(() => noteCredit(""), 6000);
  };

  const stage = document.createElement("div");
  stage.className = "sb-editor";
  root.append(stage);
  container.append(root);

  // The kit the user left last time fills the editor in; the picture comes back as the data URL it was kept as.
  const kit = loadKit();
  let creditOn = true;
  let savedTimer = 0;
  const shrunk = new WeakMap<Blob, Promise<string>>();

  // Each picture is kept small: the cover as a 256 px square, a background up to 1280 px.
  const shrinkers = {
    cover: (blob: Blob) => shrinkCover(blob),
    background: (blob: Blob) => fitPicture(blob, 1280, "image/jpeg"),
  };

  async function keep(next: Settings) {
    const entry: Kit = { title: next.title, speaker: next.speaker, handle: next.handle, links: next.links, layout: next.layout, visual: next.visual, musicVolume: next.musicVolume };
    if (typeof next.theme === "number") entry.theme = next.theme;
    for (const field of ["cover", "background"] as const) {
      const picture = next[field];
      if (picture instanceof Blob) {
        if (!shrunk.has(picture)) shrunk.set(picture, shrinkers[field](picture));
        entry[field] = await shrunk.get(picture)!.catch(() => undefined);
      } else if (typeof picture === "string" && picture.startsWith("data:image/")) entry[field] = picture;
    }
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
      // A watched ad buys one clean download; the next clip carries the credit again. The key is locked while a
      // video is made, so the credit was already off when this one started.
      if (!creditOn) setCredit(true);
      showThanks(root, settings);
    },
  });
  editor.slots.header.append(captionsControl);
  editor.slots.actions.append(creditWrap);
  editor.slots.captions.append(redoKey);

  // Captions for the whole recording, a stretch at a time: what the user has selected goes first, then the rest from
  // the start. Each stretch ends after a full sentence, so the next one starts on a fresh one.

  // A recording is open while the editor is ready, and still while it makes a video.
  const ready = () => editor.element.dataset.state === "ready" || editor.element.dataset.state === "exporting";
  let coverage = new Coverage();
  let running = false;
  let downloading: number | null = null;
  let working: Span | null = null;
  let warning = "";
  let done = false;
  // Each run gets a number; stopping or starting another makes an older one's results stale at any await.
  let run = 0;

  const transcriber = createTranscriber({
    onProgress: ({ stage: step, percent }: Progress) => {
      downloading = step === "download" && percent < 100 ? percent : null;
      update(step === "transcribe" ? percent / 100 : 0);
    },
  });

  /** The key, the line beside it and the meter, from where the captions stand now. */
  function update(within = 0) {
    const duration = editor.duration;
    const covered = Math.min(duration, coverage.covered());
    done = ready() && duration > 0 && !coverage.next(duration, [], STRETCH);
    if (running) relabel(transcribeKey, "Pause captions", ICONS.pause);
    else if (warning) relabel(transcribeKey, "Try again", ICONS.redo);
    else if (done) relabel(transcribeKey, "Edit captions", ICONS.edit);
    else relabel(transcribeKey, covered > 0 ? "Resume captions" : "Auto captions", ICONS.transcribe);
    transcribeKey.disabled = !running && !ready();
    redoKey.disabled = running || !ready();
    let text: string;
    let tone = "";
    if (warning) [text, tone] = [warning, "warn"];
    else if (!editor.source) text = "Open a recording and its captions start on their own.";
    else if (!ready()) text = "Opening the recording";
    else if (running && downloading !== null) [text, tone] = ["Downloading the speech model, first time only", "busy"];
    else if (running) [text, tone] = [`Making captions · ${clock(covered)} of ${clock(duration)} done`, "busy"];
    else if (done) [text, tone] = ["Captions ready for the whole recording. Fix any word in the Captions tab.", "done"];
    else if (covered > 0) text = `Captions paused · ${clock(covered)} of ${clock(duration)} done`;
    else text = "Press Auto captions to start. It runs on this device, so nothing is uploaded.";
    if (status.textContent !== text) status.textContent = text;
    percent.textContent = running && downloading !== null ? `${downloading}%` : "";
    root.dataset.tone = tone;
    root.toggleAttribute("data-working", running);
    const share = downloading !== null ? downloading / 100 : duration ? (covered + within * (working ? working[1] - working[0] : 0)) / duration : 0;
    meter.style.setProperty("--done", String(Math.min(1, share)));
  }

  function stop() {
    run++;
    transcriber.cancel();
    running = false;
    working = null;
    downloading = null;
    update();
  }

  /** Transcribes `span`; `open` says whether it may end early, at a sentence's end. */
  async function stretch([start, end]: Span, open: boolean, current: () => boolean) {
    const duration = editor.duration;
    const from = Math.max(0, start - PAD);
    const samples = await editor.readAudio(from, Math.min(duration, end + PAD), SPEECH_RATE);
    if (!current()) return;
    if (isSilent(samples)) return coverage.add(start, end);
    working = [start, end];
    // A word belongs to the stretch it starts in; the padding's words belong to the stretches either side.
    const words = (await transcriber.transcribe(samples, from)).filter((word) => word.start >= start);
    if (!current()) return;
    const cut = cutPoint(words, [start, end], open);
    const fresh = dropHallucinations(wordsToCues(words.filter((word) => word.start < cut)));
    editor.setCaptions(mergeCues(editor.captions, fresh, [start, cut]));
    coverage.add(start, cut);
  }

  /** Writes captions until the whole recording has them, after writing `redo` again from scratch. */
  async function work(redo: Span[] = []) {
    if (!ready()) return;
    stop();
    warning = "";
    running = true;
    const mine = ++run;
    const source = editor.source;
    // Whatever comes back is dropped once this run was stopped or another recording opened.
    const current = () => mine === run && editor.source === source;
    update();
    try {
      for (const span of redo) {
        if (!current()) return;
        await stretch(span, false, current);
        update();
      }
      while (current()) {
        const duration = editor.duration;
        const span = coverage.next(duration, editor.parts.length ? editor.parts : [editor.range], STRETCH, LEAD);
        if (!span) break;
        // A stretch cut short by the end or by captions already written ends where it is told to.
        const open = span[1] - span[0] >= STRETCH - 1e-6 && span[1] < duration - 1e-6 && !coverage.has(span[1], span[1] + 0.01);
        await stretch(span, open, current);
        update();
      }
    } catch (error) {
      if (!current()) return;
      const name = (error as Error).name;
      if (name === "DownloadError") warning = "Couldn't download the speech model. Check your connection, then press Try again.";
      else if (name === "LoadError") warning = "This device couldn't start the speech model. Try another browser, or close a few tabs.";
      else if (name !== "AbortError") warning = "Captions stopped partway through. Press Try again to carry on.";
    } finally {
      if (mine === run) {
        running = false;
        working = null;
        downloading = null;
        update();
      }
    }
  }

  transcribeKey.addEventListener("click", () => {
    if (running) stop();
    else if (done && !warning) editor.selectTab("captions");
    else void work();
  });
  // The clip's own captions written again, for when they came out wrong; then the rest carries on.
  redoKey.addEventListener("click", () => void work(editor.parts.length ? editor.parts : [editor.range]));

  // The credit.

  function setCredit(on: boolean) {
    creditOn = on;
    editor.setOverlay(on ? credit : null);
    root.toggleAttribute("data-clean", !on);
    relabel(creditKey, on ? "Remove credit" : "Put credit back", ICONS.credit);
    creditKey.title = on ? removeLabel : "Your next download has no credit. Press to put it back";
    lockCredit();
  }

  // The key rests while an ad loads and while a video is made from the current look.
  let adLoading = false;
  function lockCredit() {
    creditKey.disabled = adLoading || editor.element.dataset.state === "exporting";
  }

  async function toggleCredit() {
    if (!creditOn) {
      setCredit(true);
      noteCredit("The credit is back");
      return;
    }
    adLoading = true;
    lockCredit();
    if (settings.adUnit) noteCredit("Loading a short ad");
    const result = await watchAd(settings.adUnit);
    adLoading = false;
    if (result === "granted") {
      setCredit(false);
      noteCredit("Your next download has no credit");
      return;
    }
    setCredit(true);
    noteCredit(result === "closed"
      ? "The ad closed early, so the credit stays."
      : "The ad didn't load, so the credit stays. If you use an ad blocker, allow ads here and try again.");
  }
  creditKey.addEventListener("click", () => void toggleCredit());

  // The keys follow the editor. A recording that has just opened gets its captions written straight away.
  let opened: string | Blob | null = null;
  const watcher = new MutationObserver(() => {
    // Another recording opening ends work on the one before it.
    if (running && editor.element.dataset.state === "loading") stop();
    lockCredit();
    if (ready() && editor.source && editor.source !== opened) {
      // Captions belong to the recording they were heard in: a new one replacing another starts with none.
      if (opened) editor.setCaptions([]);
      opened = editor.source;
      coverage = new Coverage();
      warning = "";
      if (autoTranscribe) void work();
    }
    update();
  });
  watcher.observe(editor.element, { attributes: true, attributeFilter: ["data-state"] });
  setCredit(true);
  update();

  return {
    editor,
    destroy() {
      stop();
      clearTimeout(noteTimer);
      watcher.disconnect();
      editor.destroy();
      root.remove();
    },
  };
}
