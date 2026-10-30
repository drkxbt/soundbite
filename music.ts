/** A free track that ships with Soundbite, written for it by scripts/music.py, so it is the project's own to share. */
export interface Track {
  id: string;
  name: string;
  mood: string;
}

export const TRACKS: Track[] = [
  { id: "late-night", name: "Late Night", mood: "Lo-fi · 84 bpm" },
  { id: "sunny-side", name: "Sunny Side", mood: "Upbeat · 112 bpm" },
  { id: "open-sky", name: "Open Sky", mood: "Ambient · 70 bpm" },
  { id: "front-porch", name: "Front Porch", mood: "Acoustic · 96 bpm" },
];

const PLAY = '<path class="fill" d="M8 5.5v13l10.5-6.5Z"/>';
const PAUSE = '<rect class="fill" x="6.5" y="5" width="4" height="14" rx="1"/><rect class="fill" x="13.5" y="5" width="4" height="14" rx="1"/>';
const ADD = '<path d="M12 5v14M5 12h14"/>';
const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

/**
 * The free music as a list under the Music tab's own track: each row plays a moment of its track to hear it, and Use
 * puts it under the clip. `base` is where the .m4a files are; `use` is handed the chosen track as a file.
 */
export function musicLibrary(base: URL, use: (file: File) => Promise<void>): { element: HTMLElement; stop(): void } {
  const box = document.createElement("section");
  box.className = "sb-music";
  box.setAttribute("aria-labelledby", "sb-music-title");
  const title = document.createElement("h3");
  title.className = "ag-heading";
  title.id = "sb-music-title";
  title.textContent = "Free music";
  const help = document.createElement("p");
  help.className = "ag-help";
  help.setAttribute("role", "status");
  help.textContent = "Written for Soundbite, free to use under any clip.";
  const list = document.createElement("ul");
  list.className = "sb-tracks";
  box.append(title, help, list);

  const preview = new Audio();
  preview.preload = "none";
  let playing: string | null = null;
  const plays = new Map<string, HTMLButtonElement>();
  const mark = () => {
    for (const [id, button] of plays) {
      const on = id === playing;
      const track = TRACKS.find((item) => item.id === id)!;
      button.innerHTML = svg(on ? PAUSE : PLAY);
      button.setAttribute("aria-label", `${on ? "Stop" : "Play"} ${track.name}`);
      button.setAttribute("aria-pressed", String(on));
    }
  };
  const stop = () => {
    preview.pause();
    playing = null;
    mark();
  };
  preview.addEventListener("ended", stop);

  for (const track of TRACKS) {
    const url = new URL(`${track.id}.m4a`, base).href;
    const row = document.createElement("li");
    row.className = "sb-track";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "ag-key sb-track-play";
    plays.set(track.id, play);
    play.addEventListener("click", () => {
      if (playing === track.id) return stop();
      preview.src = url;
      playing = track.id;
      mark();
      void preview.play().catch(stop);
    });
    const words = document.createElement("span");
    words.className = "sb-track-words";
    const name = document.createElement("span");
    name.className = "sb-track-name";
    name.textContent = track.name;
    const mood = document.createElement("span");
    mood.className = "sb-track-mood";
    mood.textContent = track.mood;
    words.append(name, mood);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "ag-key sb-track-use";
    add.innerHTML = `${svg(ADD)}<span class="ag-key-text">Use</span>`;
    add.setAttribute("aria-label", `Use ${track.name} as background music`);
    add.addEventListener("click", async () => {
      stop();
      add.disabled = true;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        await use(new File([await response.blob()], `${track.name}.m4a`, { type: "audio/mp4" }));
        help.textContent = `${track.name} is under the clip now.`;
      } catch {
        help.textContent = `${track.name} didn't load. Check the connection and try again.`;
      } finally {
        add.disabled = false;
      }
    });
    row.append(play, words, add);
    list.append(row);
  }
  mark();
  return { element: box, stop };
}
