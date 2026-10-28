import type { Word } from "@drkxbt/audiogram";
import { SPEECH_RATE } from "./audio.js";
import { toWords } from "./cues.js";
import type { WorkerMessage } from "./transcribe-worker.js";

export interface Progress {
  stage: "download" | "transcribe";
  percent: number;
}

export interface Transcriber {
  /** The words in `samples` (16 kHz, one channel), in recording time: `offset` is where the samples start. */
  transcribe(samples: Float32Array, offset: number): Promise<Word[]>;
  /** Stops the work in hand, if any; its promise rejects with an AbortError. The model stays cached for next time. */
  cancel(): void;
}

/**
 * Whisper in a worker, started on the first transcription. A failed model download rejects with an error named
 * "DownloadError", so the page can offer to try again.
 */
export function createTranscriber({ onProgress }: { onProgress?: (progress: Progress) => void } = {}): Transcriber {
  let worker: Worker | null = null;
  let pending: { resolve(words: Word[]): void; reject(error: Error): void; offset: number; length: number } | null = null;

  const fail = (error: Error) => {
    pending?.reject(error);
    pending = null;
  };

  function start(): Worker {
    const next = new Worker(new URL("./transcribe-worker.js", import.meta.url), { type: "module" });
    next.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") onProgress?.({ stage: message.stage, percent: message.percent });
      else if (message.type === "done") {
        pending?.resolve(toWords(message.chunks, pending.offset, pending.length));
        pending = null;
      } else {
        const error = new Error(message.message);
        error.name = message.name;
        fail(error);
      }
    });
    next.addEventListener("error", (event) => {
      fail(new Error(event.message || "The speech worker stopped"));
      next.terminate();
      if (worker === next) worker = null;
    });
    return next;
  }

  return {
    transcribe(samples, offset) {
      if (pending) return Promise.reject(new Error("A transcription is already running"));
      worker ??= start();
      return new Promise<Word[]>((resolve, reject) => {
        pending = { resolve, reject, offset, length: samples.length / SPEECH_RATE };
        worker!.postMessage({ samples }, [samples.buffer]);
      });
    },
    cancel() {
      // Only work in hand is stopped; an idle worker keeps its model warm for the next part.
      if (!pending) return;
      worker?.terminate();
      worker = null;
      fail(new DOMException("Transcription cancelled", "AbortError"));
    },
  };
}
