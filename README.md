# soundbite

Turn the best minute of an X Space, a podcast or a voice note into a captioned video for X, TikTok, Reels, Shorts or LinkedIn, in the browser. Open the recording and Whisper writes out every word and times it as it is said, starting with the moment you select. Pick a look and download an MP4. Everything runs on your device: the audio, the transcript and your picture are never uploaded.

Make a clip on [drk.vc/engines/soundbite](https://drk.vc/engines/soundbite), nothing to install.

![Soundbite in a dark page: the bar above the editor says the captions are in, the preview shows drk's name with a small "made with drk.vc/engines/soundbite" in its top right corner, the captions list holds whole sentences, and a small card thanks the user as the clip downloads, with keys to follow on X and star the repo](demo/preview.jpg)

Hosted audiogram apps upload the recording, then charge a monthly plan for automatic captions and a clip without a watermark. Soundbite does both on the device and is MIT licensed, every feature included.

- **The whole recording, captioned.** Open a recording and every minute of it is captioned, two minutes at a time, starting with the part you select; MP3 and WAV files can be hours long. Each stretch ends at a sentence's end or a pause where it can, so words aren't cut at the joins. Auto captions at the top pauses and resumes, and the line beside it says how far it has got.
- **Captions without typing.** Whisper (tiny, multilingual) runs in a worker through transformers.js. The encoder runs on WebGPU and the decoder on WebAssembly when there is a GPU, and everything runs on WebAssembly when there isn't. The recording is transcribed two minutes at a time, the part you selected first; each two minutes takes about 10 to 45 seconds on a laptop. Every word keeps its own time, so the captions light up as each word is said.
- **Several moments, several recordings, one clip.** Split cuts the clip in two at the playhead so each half can be trimmed on its own, and Add recording brings in another file from your computer after what is in the clip, captioned as soon as it opens. The parts play back to back, in an order you can drag; they are captioned before the rest, and a join between two cuts fades so a cut mid-word doesn't click.
- **Fix anything.** The captions land in Audiogram's editor, where any line can be retyped or retimed by tapping along. Silence is caught before Whisper runs, and the stock phrases Whisper writes over noise, in any language, count as no speech, so your captions stay as they were.
- **Design every frame.** A recording brings only its sound; the picture starts as a white page, or as one of twenty classic podcast designs, gilded, letterpressed and Art Deco, each laid out for every shape and each keeping its own background.
  - Elements has a section for each kind of part, painted in your design's colours: captions and sound, shapes, lines and curves, photo frames and grids, free photos, moving backgrounds, charts, tables, device mockups and 3D shapes, with a search and the ones you used last first.
  - Add headings and pairs of fonts, forty free photos, and your own photos and videos; drop a photo on a frame to fill it.
  - Colour anything from a picker with the colours already in your design, a set of defaults, gold, rose gold, silver, bronze and champagne finishes, gradients for the page, and any shade at all.
  - Start over clears the design in one step, and Undo brings it back.
  - Pick several things at once, group them, align and spread them; right-click for a menu.
  - Set fonts, spacing and effects for words, borders for shapes, and crops, frames and filters for pictures.
  - Choose how each part comes in, goes and moves from tiles that show each movement, word by word if you like, then play it once on the picture.
  - Zoom in to work closely.
  - The layout of each shape and your uploads are kept in this browser for next time.
- **Clips as long as the recording.** A recording opens fully selected and plays from end to end; trim it to any stretch, however long, and the download works through it twenty seconds at a time. A percent shows while a recording is read in.
- **57 fonts for English text.** Open-licence fonts from Fontsource, from Inter and Poppins to Cinzel, Playfair Display, Bodoni Moda and Pinyon Script, bundled with the app and fetched only when used.
- **Your look on it.** A background picture or video behind the design, up to three links along the bottom, and music under your voice at the level you set. Then Audiogram's own: square, 4:5, 9:16 or 16:9; bars, a wave or a pulse; five colour themes, your picture, name, handle and title, and an MP4 made faster than it plays where the browser has WebCodecs.
- **Your look, kept.** Name, handle, links, pictures, shape and colours are kept in this browser and filled in next time.
- **A credit, and a way to drop it.** Clips made at drk.vc/engines/soundbite carry a small "made with drk.vc/engines/soundbite" in the corner. Watching one short rewarded ad removes it from the next download; until ads are switched on there, it comes off for free. A copy you run yourself has no ad unit, so its credit comes off for free too.

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
    media: "",                                // your stock search endpoint, or empty for no stock media
  });
</script>
```

Give the container a height; the editor fills it. `soundbite()` returns `{ editor, destroy() }`, where `editor` is the Audiogram editor.

`media` turns on the stock photos, illustrations, videos, stickers and GIFs in the Elements panel. Soundbite asks it `GET <media>?source=pixabay|pexels|giphy&kind=photo|illustration|video|sticker|gif&q=<words>&page=<n>` and expects `{ items: [{ id, kind, name, thumb, file, width, height, credit?: { name, url }, link }], more }`. The endpoint keeps the libraries' API keys on your server. Asked with no parameters, it can answer `{ sources: ["pixabay", "giphy"] }` to name the libraries it has keys for, and only those are asked; without that list every library is asked, and one that answers with an error is left out of the panel.

A page with a Content Security Policy needs these sources:
- `script-src 'self' 'wasm-unsafe-eval'` for the speech model's runtime;
- `worker-src 'self'`;
- `connect-src 'self' https://huggingface.co https://*.hf.co` for the model files;
- `media-src 'self' blob:` and `img-src 'self' blob: data:` for the recording and pictures;
- with `media` set, the stock libraries' image hosts in `img-src` and the hosts its files download from in `connect-src`.

An ad unit also needs Google Publisher Tag's hosts. Nothing writes a `style` attribute, so `style-src 'self'` holds.

## Test

```bash
npm test
```

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
