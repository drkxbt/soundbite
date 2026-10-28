export { decode, rangeSamples, SPEECH_RATE } from "./audio.js";
export { isHallucination, mergeCues, toWords, wordsToCues, type Chunk } from "./cues.js";
export { createTranscriber, type Progress, type Transcriber } from "./transcribe.js";
export { loadKit, parseKit, saveKit, shrinkCover, type Kit } from "./kit.js";
export { credit, CREDIT } from "./credit.js";
export { watchAd, type AdResult } from "./ads.js";
export { config, type Config } from "./config.js";
export { soundbite, type Soundbite, type SoundbiteOptions } from "./app.js";
export { showThanks } from "./panel.js";
