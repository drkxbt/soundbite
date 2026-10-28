// Speech recognition off the page's thread. In: { samples } at 16 kHz. Out: progress, then the words or an error.
import { env, pipeline, WhisperTextStreamer, type AutomaticSpeechRecognitionPipeline, type WhisperTokenizer } from "@huggingface/transformers";
import { SPEECH_RATE } from "./audio.js";
import type { Chunk } from "./cues.js";
import { isNetworkFailure } from "./failures.js";

export type WorkerMessage =
  | { type: "progress"; stage: "download" | "transcribe"; percent: number }
  | { type: "done"; chunks: Chunk[] }
  | { type: "error"; name: "DownloadError" | "LoadError" | "Error"; message: string };

// Pinned, so a change upstream can't change what visitors download.
const MODEL = "onnx-community/whisper-tiny_timestamped";
const REVISION = "517244293732ee2d58139af5814231b7e6830a0d";
// The pipeline's window and overlap, in seconds: each window moves the transcript on by 30 - 2 × 5.
const WINDOW = 30;
const STRIDE = 5;

env.backends.onnx.wasm!.wasmPaths = new URL("./ort/", import.meta.url).href;

const post = (message: WorkerMessage) => (self as unknown as { postMessage(message: WorkerMessage): void }).postMessage(message);

let model: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  // transformers.js sizes every file the model needs up front; its running total can still wobble back a point
  // when a file's size is corrected mid-download, so the bar only ever moves forward.
  let shown = 0;
  const progress_callback = (event: { status: string; progress?: number }) => {
    if (event.status !== "progress_total" || !Number.isFinite(event.progress)) return;
    const percent = Math.min(99, Math.round(event.progress!));
    if (percent <= shown) return;
    shown = percent;
    post({ type: "progress", stage: "download", percent });
  };
  const open = (gpu: boolean) =>
    pipeline("automatic-speech-recognition", MODEL, {
      revision: REVISION,
      // Measured: the encoder runs fastest on the GPU, the decoder's many small steps on the CPU.
      device: gpu ? { encoder_model: "webgpu", decoder_model_merged: "wasm" } : "wasm",
      dtype: gpu ? { encoder_model: "fp32", decoder_model_merged: "q8" } : "q8",
      progress_callback,
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  return (async () => {
    const adapter = await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter().catch(() => null);
    if (!adapter) return open(false);
    try {
      return await open(true);
    } catch (error) {
      // A GPU that can't run the encoder falls back to WebAssembly; a dropped download is a download problem either way.
      if (isNetworkFailure(error)) throw error;
      return open(false);
    }
  })();
}

self.addEventListener("message", async (event: MessageEvent<{ samples: Float32Array }>) => {
  const { samples } = event.data;
  let asr: AutomaticSpeechRecognitionPipeline;
  try {
    const loading = !model;
    model ??= load();
    asr = await model;
    // Only the run that loaded the model reports the download finished; later runs start straight at listening.
    if (loading) post({ type: "progress", stage: "download", percent: 100 });
  } catch (error) {
    model = null;
    post({ type: "error", name: isNetworkFailure(error) ? "DownloadError" : "LoadError", message: String((error as Error)?.message ?? error) });
    return;
  }
  try {
    const windows = Math.max(1, Math.ceil(samples.length / ((WINDOW - 2 * STRIDE) * SPEECH_RATE)));
    let finished = 0;
    post({ type: "progress", stage: "transcribe", percent: 0 });
    // A Whisper pipeline always carries Whisper's tokenizer; the pipeline's type only promises the base class.
    const streamer = new WhisperTextStreamer(asr.tokenizer as WhisperTokenizer, {
      on_finalize: () => post({ type: "progress", stage: "transcribe", percent: Math.min(99, Math.round((++finished / windows) * 100)) }),
    });
    const output = await asr(samples, { return_timestamps: "word", chunk_length_s: WINDOW, stride_length_s: STRIDE, streamer });
    post({ type: "progress", stage: "transcribe", percent: 100 });
    post({ type: "done", chunks: ((Array.isArray(output) ? output[0] : output).chunks ?? []) as Chunk[] });
  } catch (error) {
    post({ type: "error", name: "Error", message: String((error as Error)?.message ?? error) });
  }
});
