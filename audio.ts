/** Whisper hears 16 kHz. */
export const SPEECH_RATE = 16000;

/** A recording as Audiogram decoded it: one channel at its own rate. */
export interface Recording {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * One stretch of the recording at Whisper's 16 kHz. It is cut from the copy Audiogram already decoded, so an hour of
 * audio is held once, and only the stretch is resampled.
 */
export async function rangeSamples({ samples, sampleRate }: Recording, start: number, end: number): Promise<Float32Array> {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(samples.length, Math.ceil(end * sampleRate));
  const length = Math.max(1, to - from);
  const stretch = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  stretch.copyToChannel(samples.subarray(from, from + length) as Float32Array<ArrayBuffer>, 0);
  const context = new OfflineAudioContext(1, Math.max(1, Math.round((length * SPEECH_RATE) / sampleRate)), SPEECH_RATE);
  const player = context.createBufferSource();
  player.buffer = stretch;
  player.connect(context.destination);
  player.start();
  // A copy of its own, since the samples are handed over to the speech worker.
  return (await context.startRendering()).getChannelData(0).slice();
}

/**
 * True when a stretch has no sound worth listening to: its loudness (RMS) under about -48 dBFS. Silence is caught
 * here instead of sent to Whisper, which fills it with stock phrases, and the model need not even download.
 */
export function isSilent(samples: Float32Array, threshold = 0.004): boolean {
  if (!samples.length) return true;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length) < threshold;
}
