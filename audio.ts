/** Whisper hears 16 kHz. */
export const SPEECH_RATE = 16000;

/**
 * True when a stretch has no sound worth listening to: every five seconds of it (at 16 kHz) under about -48 dBFS RMS,
 * so a few quiet words in minutes of silence still count. Silence is caught here instead of sent to Whisper, which
 * fills it with stock phrases, and the model need not even download.
 */
export function isSilent(samples: Float32Array, threshold = 0.004, window = SPEECH_RATE * 5): boolean {
  for (let from = 0; from < samples.length; from += window) {
    const to = Math.min(samples.length, from + window);
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    if (Math.sqrt(sum / (to - from)) >= threshold) return false;
  }
  return true;
}
