import { soundbite } from "../dist/app/soundbite.js";

const app = soundbite(document.querySelector("[data-app]"));

// The sample is two computer voices reading a made-up exchange, so a first visit can try the whole flow.
document.querySelector("[data-sample]").addEventListener("click", async () => {
  const blob = await (await fetch("sample/space.wav")).blob();
  await app.editor.load(new File([blob], "sample-space.wav", { type: "audio/wav" }));
});
