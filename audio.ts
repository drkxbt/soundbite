/** Whisper hears 16 kHz. */
export const SPEECH_RATE = 16000;

/**
 * The recording decoded once at Whisper's rate. Decoding straight to 16 kHz keeps an hour of stereo near 460 MB
 * instead of the 1.4 GB it takes at 48 kHz.
 */
export async function decode(file: Blob): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(1, 1, SPEECH_RATE);
  return context.decodeAudioData(await file.arrayBuffer());
}

/** One stretch of a decoded recording as a single channel, the channels averaged. */
export function rangeSamples(buffer: AudioBuffer, start: number, end: number): Float32Array {
  const from = Math.max(0, Math.floor(start * buffer.sampleRate));
  const to = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
  const samples = new Float32Array(Math.max(0, to - from));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) samples[i] += data[from + i] / buffer.numberOfChannels;
  }
  return samples;
}
