// How each browser words a fetch that never arrived, and transformers.js a model file it couldn't get.
const NETWORK = /failed to fetch|networkerror|load failed|network connection|could not locate file|err_internet|err_network/i;

/** True when an error loading the speech model came from the network rather than from the device running it. */
export function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK.test(message);
}
