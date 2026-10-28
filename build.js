// Bundles the app and the speech worker for the browser, with ONNX Runtime's WebAssembly next to them.
import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

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
