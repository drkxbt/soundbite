// Bundles the app and the speech worker for the browser, with ONNX Runtime's WebAssembly next to them.
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { writeLibrary } from "./scripts/library.js";

const out = "dist/app";
await build({
  entryPoints: { soundbite: "index.ts", "transcribe-worker": "transcribe-worker.ts" },
  bundle: true,
  format: "esm",
  target: "es2022",
  outdir: out,
  minify: true,
  sourcemap: true,
  logLevel: "warning",
});
// The runtime transformers.js loads for both WebGPU and WebAssembly; it must match the bundled onnxruntime-web.
await mkdir(`${out}/ort`, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"]) {
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `${out}/ort/${file}`);
}

// One stylesheet: Audiogram's editor first, then Soundbite's dark theme and bar over it.
const css = await Promise.all(["node_modules/@drkxbt/audiogram/audiogram.css", "soundbite.css"].map((file) => readFile(file, "utf8")));
await writeFile(`${out}/soundbite.css`, css.join("\n"));

// The editor's fonts, for English text: each one's Latin and Latin Extended files as its package ships them, its
// licence, and a list of them all that the editor reads. Only the files a font is used with are ever downloaded.
const { FONTS } = await import("./dist/fonts.js");
const SUBSETS = new Set(["latin", "latin-ext"]);
await mkdir(`${out}/fonts`, { recursive: true });
const fonts = [];
for (const spec of FONTS) {
  const dir = `node_modules/${spec.variable ? "@fontsource-variable" : "@fontsource"}/${spec.id}`;
  const sheets = spec.variable ? ["index.css"] : ["400.css", "700.css"].filter((sheet) => existsSync(`${dir}/${sheet}`));
  const entry = { name: spec.name, category: spec.category, family: "", files: [] };
  for (const sheet of sheets) {
    const text = await readFile(`${dir}/${sheet}`, "utf8");
    for (const [, label, body] of text.matchAll(/\/\* ([^*]+) \*\/\s*@font-face \{([^}]+)\}/g)) {
      const subset = label.slice(spec.id.length + 1).replace(/-(\d+|wght)-normal$/, "");
      if (!SUBSETS.has(subset) || !label.endsWith("-normal")) continue;
      const field = (name) => body.match(new RegExp(`${name}:\s*([^;]+);`))?.[1].trim();
      const file = field("src").match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
      entry.family = field("font-family").replace(/^'|'$/g, "");
      entry.files.push({ file, weight: field("font-weight"), unicodeRange: field("unicode-range") });
      await copyFile(`${dir}/files/${file}`, `${out}/fonts/${file}`);
    }
  }
  if (!entry.files.length) throw new Error(`No font files found for ${spec.id}`);
  await copyFile(`${dir}/LICENSE`, `${out}/fonts/${spec.id}-LICENSE.txt`);
  fonts.push(entry);
}
await writeFile(`${out}/fonts/fonts.json`, JSON.stringify(fonts));

// The background photos, as scripts/photos.py leaves them: each photo, its thumbnail, the list the editor reads and
// the credits, all served from here so the editor never loads a picture from another host. Cleared first, so a photo
// the script has since replaced is not left behind.
await rm(`${out}/photos`, { recursive: true, force: true });
await cp("photos", `${out}/photos`, { recursive: true });

// The editor's graphics and stickers: free icon sets flattened to path data, so drawing one never taints the canvas,
// with each set's licence beside them. An icon that can't be flattened is left out, and the count of those is shown.
for (const { set, count, skipped } of await writeLibrary(`${out}/library`)) {
  const lost = Object.entries(skipped).map(([reason, n]) => `${n} (${reason})`);
  if (lost.length) console.log(`library: kept ${count} from ${set}, left out ${lost.join(", ")}`);
}
