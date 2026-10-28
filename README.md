# soundbite

Turn the best minute of an X Space, a podcast or a voice note into a captioned video for X, TikTok, Reels, Shorts or LinkedIn, in the browser. Open the recording and Whisper writes out every word and times it as it is said, starting with the moment you select. Pick a look and download an MP4. Everything runs on your device: the audio, the transcript and your picture are never uploaded.

Make a clip on [drk.vc/soundbite](https://drk.vc/soundbite), nothing to install.

![Soundbite in a dark page: the bar above the editor says the captions are in, the preview shows drk's name with a small "made with drk.vc/soundbite" in its top right corner, the captions list holds whole sentences, and a small card thanks the user as the clip downloads, with keys to follow on X and star the repo](demo/preview.jpg)

Hosted audiogram apps upload the recording, then charge a monthly plan for automatic captions and a clip without a watermark. Soundbite does both on the device and is MIT licensed, every feature included.

- **The whole recording, captioned.** Open a recording and every minute of it is captioned, two minutes at a time, starting with the part you select; MP3 and WAV files can be hours long. Each stretch ends at a sentence's end or a pause where it can, so words aren't cut at the joins. Auto captions at the top pauses and resumes, and the line beside it says how far it has got.
- **Captions without typing.** Whisper (tiny, multilingual) runs in a worker through transformers.js. The encoder runs on WebGPU and the decoder on WebAssembly when there is a GPU, and everything runs on WebAssembly when there isn't. The recording is transcribed two minutes at a time, the part you selected first; each two minutes takes about 10 to 45 seconds on a laptop. Every word keeps its own time, so the captions light up as each word is said.
- **Several moments, one clip.** Add each moment as a part and they play back to back, in an order you can drag; parts are captioned before the rest of the recording, and the joins fade so a cut mid-word doesn't click.
- **Fix anything.** The captions land in Audiogram's editor, where any line can be retyped or retimed by tapping along. Silence is caught before Whisper runs, and the stock phrases Whisper writes over noise, in any language, count as no speech, so your captions stay as they were.
- **Design it like Canva.** A recording brings only its sound; the picture starts as a white page. Add captions, sound bars, a wave or a pulse, your name and picture, headings, ten shapes, stickers and your own photos and videos; move, size and turn anything, type straight onto it, and set its font, colour, effects (outline, shadow, a colour behind words, capitals), the way it comes in and the stretch it shows for. Start from a template, give the page any colour or gradient, set a video as the background, align, lock, copy and paste. The layout of each shape and your uploads are kept in this browser for next time.
- **Clips as long as the recording.** A recording opens fully selected and plays from end to end; trim it to any stretch, however long, and the download works through it twenty seconds at a time. A percent shows while a recording is read in.
- **47 fonts for English text.** Open-licence fonts from Fontsource, from Inter and Poppins to Bebas Neue, Playfair Display and Permanent Marker, bundled with the app and fetched only when used.
- **Your look on it.** A background picture behind the whole clip, dimmed so the words stay readable, up to three links along the bottom, and music under your voice at the level you set. Then Audiogram's own: square, 4:5, 9:16 or 16:9; bars, a wave or a pulse; five colour themes, your picture, name, handle and title, and an MP4 made faster than it plays where the browser has WebCodecs.
- **Your look, kept.** Name, handle, links, pictures, shape and colours are kept in this browser and filled in next time.
- **A credit, and a way to drop it.** Clips made at drk.vc/soundbite carry a small "made with drk.vc/soundbite" in the corner. Watching one short rewarded ad removes it from the next download; until ads are switched on there, it comes off for free. A copy you run yourself has no ad unit, so its credit comes off for free too.

The speech model is about 44 to 66 MB on the first use, downloaded from Hugging Face and then kept by the browser. ONNX Runtime's WebAssembly (27 MB) is served next to the app.

## Run it

```bash
git clone https://github.com/drkxbt/soundbite
cd soundbite
npm install
npm run demo
```

Then open http://localhost:4340/demo/.

## Put it in a page

`npm run build` writes `dist/app/`: `soundbite.js`, `transcribe-worker.js`, `soundbite.css` and the ONNX Runtime files in `ort/`. Keep them together.

```html
<link rel="stylesheet" href="soundbite.css">
<div id="clip"></div>
<script type="module">
  import { soundbite } from "./soundbite.js";
  soundbite(document.querySelector("#clip"), {
    adUnit: "",                               // a Google Ad Manager rewarded ad unit, or empty for no ads
    x: "drkxbt",                              // the account the after-download card asks people to follow
    repo: "https://github.com/drkxbt/soundbite",
  });
</script>
```

Give the container a height; the editor fills it. `soundbite()` returns `{ editor, destroy() }`, where `editor` is the Audiogram editor.

A page with a Content Security Policy needs these sources:
- `script-src 'self' 'wasm-unsafe-eval'` for the speech model's runtime;
- `worker-src 'self'`;
- `connect-src 'self' https://huggingface.co https://*.hf.co` for the model files;
- `media-src 'self' blob:` and `img-src 'self' blob: data:` for the recording and pictures.

An ad unit also needs Google Publisher Tag's hosts. Nothing writes a `style` attribute, so `style-src 'self'` holds.

## Test

```bash
npm test
```

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
