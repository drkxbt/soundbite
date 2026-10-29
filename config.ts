/**
 * What a copy of Soundbite is set to. The hosting page can pass its own: drk.vc passes its rewarded ad unit, and a
 * fork points the after-download panel at its own X account and repo.
 */
export interface Config {
  /** A Google Ad Manager rewarded ad unit path. Empty means the credit comes off without an ad. */
  adUnit: string;
  /** The X account the panel asks people to follow, without the @. */
  x: string;
  /** The repo the panel asks people to star. */
  repo: string;
  /** The hosting site's stock search, which keeps the sources' keys; empty for no stock photos, videos or stickers. */
  media: string;
}

export const config: Config = { adUnit: "", x: "drkxbt", repo: "https://github.com/drkxbt/soundbite", media: "" };
