// A looping tour for the card recordings: open the sample, get its captions, play them, take the credit off, and
// download. The captions are Whisper's real output for the sample, saved once, so every loop lasts the same time;
// the transcription itself is shown with its progress compressed into a second.
import { credit, showThanks, config } from "../dist/app/soundbite.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function run(app) {
  const $ = (selector) => document.querySelector(selector);
  const root = $(".sb");
  const finger = document.createElement("div");
  finger.className = "finger";
  document.body.append(finger);
  const point = (element, down) => {
    const box = element.getBoundingClientRect();
    finger.style.translate = `${box.left + box.width / 2 - 22}px ${box.top + box.height / 2 - 22}px`;
    finger.toggleAttribute("data-on", true);
    finger.toggleAttribute("data-down", down);
  };
  async function tap(element, click = true) {
    point(element, true);
    await wait(110);
    point(element, false);
    if (click) element.click();
    await wait(160);
    finger.removeAttribute("data-on");
  }
  const status = (text, tone, percent) => {
    $(".sb-status").textContent = text;
    root.dataset.tone = tone;
    root.toggleAttribute("data-working", percent !== null);
    $(".sb-meter").style.setProperty("--done", String((percent ?? 0) / 100));
  };

  const [captions, blob] = await Promise.all([
    fetch("sample/space.captions.json").then((response) => response.json()),
    fetch("sample/space.wav").then((response) => response.blob()),
  ]);
  await app.editor.load(new File([blob], "sample-space.wav", { type: "audio/wav" }));
  // The same title and name Audiogram's own demo uses for this sample.
  const [title, name, handle] = document.querySelectorAll(".ag-input");
  for (const [field, value] of [[title, "Shipping in public"], [name, "drk"], [handle, "@drkxbt"]]) {
    field.value = value;
    field.dispatchEvent(new Event("input"));
  }

  function restart() {
    app.editor.pause();
    app.editor.setRange(0, 30);
    app.editor.setCaptions([]);
    app.editor.setOverlay(credit);
    root.removeAttribute("data-clean");
    $(".sb-credit").disabled = false;
    $(".sb-credit-note").textContent = "Clips carry a small made-with credit";
    $(".sb-thanks")?.hidePopover?.();
    status("Captions for 0:00 to 0:30, written on this device", "", null);
  }

  const script = async (at) => {
    restart();
    await at(500);
    await tap($(".sb-transcribe"), false);
    for (const percent of [12, 38, 64, 88]) {
      status(`Listening, ${percent}%`, "busy", percent);
      await wait(260);
    }
    app.editor.setCaptions(captions);
    status("Captions in. Fix any word in the list on the right", "done", null);
    await at(2200);
    app.editor.play();
    await at(7700);
    app.editor.pause();
    await tap($(".sb-credit"));
    await at(8700);
    await tap($(".ag-export"), false);
    showThanks(root, config);
  };

  const { start, period } = await new Promise((resolve) => {
    const hello = setInterval(() => parent.postMessage({ tourReady: "desk" }, "*"), 300);
    parent.postMessage({ tourReady: "desk" }, "*");
    addEventListener("message", (event) => {
      if (!event.data?.tourStart) return;
      clearInterval(hello);
      resolve({ start: event.data.tourStart, period: event.data.period });
    });
  });
  for (let k = 0; ; k++) {
    const t0 = start + k * period;
    await script((ms) => wait(Math.max(0, t0 + ms - Date.now())));
    await wait(Math.max(0, t0 + period - Date.now()));
  }
}
