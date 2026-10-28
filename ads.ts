/** How a request to watch an ad ended: watched to the reward, closed before it, or no ad could be shown. */
export type AdResult = "granted" | "closed" | "unavailable";

// Just the parts of Google Publisher Tag a rewarded slot uses.
interface Slot {
  addService(service: unknown): Slot;
}
interface SlotEvent {
  slot: Slot;
  isEmpty?: boolean;
  makeRewardedVisible?: () => void;
}
interface GoogleTag {
  cmd: Array<() => void>;
  enums: { OutOfPageFormat: { REWARDED: unknown } };
  defineOutOfPageSlot(adUnit: string, format: unknown): Slot | null;
  pubads(): { addEventListener(type: string, listener: (event: SlotEvent) => void): void; removeEventListener(type: string, listener: (event: SlotEvent) => void): void };
  enableServices(): void;
  display(slot: Slot): void;
  destroySlots(slots: Slot[]): void;
}

const GPT = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
let library: Promise<GoogleTag> | null = null;

// Google's tag loads once, and only when someone first asks for an ad; a page that never does never contacts Google.
function loadTag(): Promise<GoogleTag> {
  library ??= new Promise((resolve, reject) => {
    const scope = window as unknown as { googletag?: GoogleTag };
    scope.googletag ??= { cmd: [] } as unknown as GoogleTag;
    const script = document.createElement("script");
    script.src = GPT;
    script.async = true;
    script.addEventListener("load", () => resolve(scope.googletag!));
    script.addEventListener("error", () => {
      library = null;
      script.remove();
      reject(new Error("Google's ad tag did not load"));
    });
    document.head.append(script);
  });
  return library;
}

/**
 * Plays one rewarded video ad from `adUnit`. With no ad unit (a fork, or local work) it grants at once, so the open
 * source app needs no ad account. An ad blocker, no ad to fill, or nothing ready within `timeout` ms is "unavailable".
 */
export async function watchAd(adUnit: string, { timeout = 10000 } = {}): Promise<AdResult> {
  if (!adUnit) return "granted";
  return new Promise<AdResult>((resolve) => {
    let shown = false;
    let settled = false;
    let cleanup = () => {};
    const finish = (result: AdResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };
    // Counted from the request, not from the tag's arrival: a tag that never loads, a blocker's stand-in that never
    // runs the queue, or no ad to show all end here. Once the ad is on screen the person decides how long it takes.
    const timer = setTimeout(() => !shown && finish("unavailable"), timeout);
    loadTag().then((tag) => tag.cmd.push(() => {
      try {
        const slot = tag.defineOutOfPageSlot(adUnit, tag.enums.OutOfPageFormat.REWARDED);
        if (!slot) return finish("unavailable");
        const pubads = tag.pubads();
        let granted = false;
        const mine = (listener: (event: SlotEvent) => void) => (event: SlotEvent) => event.slot === slot && listener(event);
        const listeners: Array<[string, (event: SlotEvent) => void]> = [
          ["rewardedSlotReady", mine((event) => {
            // The person already asked to watch by pressing the button, so the ad opens straight away.
            shown = true;
            event.makeRewardedVisible?.();
          })],
          ["rewardedSlotGranted", mine(() => (granted = true))],
          ["rewardedSlotClosed", mine(() => finish(granted ? "granted" : "closed"))],
          ["slotRenderEnded", mine((event) => event.isEmpty && finish("unavailable"))],
        ];
        cleanup = () => {
          for (const [type, listener] of listeners) pubads.removeEventListener(type, listener);
          tag.destroySlots([slot]);
        };
        for (const [type, listener] of listeners) pubads.addEventListener(type, listener);
        slot.addService(pubads);
        tag.enableServices();
        tag.display(slot);
      } catch {
        finish("unavailable");
      }
    }), () => finish("unavailable"));
  });
}
