import type { Overlay } from "@drkxbt/audiogram";

export const CREDIT = "made with drk.vc/soundbite";

/**
 * "made with drk.vc/soundbite", small, in the top right corner of every frame. It sits in the margin Audiogram
 * leaves above the header in all three shapes, so it never covers the name, the visual or the captions.
 */
export const credit: Overlay = (ctx, { width, height, unit, theme, font }) => {
  // The same margin Audiogram lays its frame out with.
  const pad = Math.round(Math.min(width, height) * 0.074);
  ctx.font = `500 ${Math.round(22 * unit)}px ${font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.muted;
  ctx.globalAlpha = 0.85;
  ctx.fillText(CREDIT, width - pad, pad / 2);
};
