import type { Quality } from "@drkxbt/audiogram";
import type { AdResult } from "./ads.js";

/** A download size and the rewarded ads it takes. */
export interface Tier extends Quality {
  ads: number;
}

/**
 * The sizes under Download. 360p and 720p are free and carry the corner credit; 1080p and 1440p wear a gold crown,
 * come out without the credit, and take one rewarded ad and two in a row.
 */
export const TIERS: Tier[] = [
  { short: 360, note: "Free · with credit", ads: 0 },
  { short: 720, note: "Free · with credit", ads: 0 },
  { short: 1080, premium: true, clean: true, note: "Ad · 30 s", ads: 1 },
  { short: 1440, premium: true, clean: true, note: "Ads · 1–2 min", ads: 2 },
];

/** Plays the ads a size takes, one after another. The first that isn't watched to its reward stops the rest. */
export async function unlock(tier: Tier, watch: () => Promise<AdResult>): Promise<AdResult> {
  for (let played = 0; played < tier.ads; played++) {
    const result = await watch();
    if (result !== "granted") return result;
  }
  return "granted";
}
