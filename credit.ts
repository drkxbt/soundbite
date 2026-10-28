import type { Overlay } from "@drkxbt/audiogram";

export const CREDIT = "made with drk.vc/soundbite";
const LEAD = "made with";
const SITE = "drk.vc/soundbite";

/**
 * "made with drk.vc/soundbite" as a small label in the top right corner of every frame: a faint chip in the theme's
 * text colour with a dot of its accent. It sits in the margin Audiogram leaves above the header in all three shapes, so
 * it never covers the name, the visual or the captions.
 */
export const credit: Overlay = (ctx, { width, height, unit, theme, font }) => {
  // The same margin Audiogram lays its frame out with.
  const pad = Math.round(Math.min(width, height) * 0.074);
  const size = Math.round(20 * unit);
  const tall = Math.round(36 * unit);
  const inset = 12 * unit;
  const dot = 3.5 * unit;
  ctx.font = `500 ${size}px ${font}`;
  const lead = ctx.measureText(LEAD).width;
  const space = ctx.measureText(" ").width;
  ctx.font = `650 ${size}px ${font}`;
  const site = ctx.measureText(SITE).width;
  const wide = inset + dot * 2 + 8 * unit + lead + space + site + inset;
  const x = width - pad - wide;
  const y = (pad - tall) / 2;
  const middle = y + tall / 2;

  ctx.beginPath();
  ctx.roundRect(x, y, wide, tall, 8 * unit);
  ctx.fillStyle = theme.text;
  ctx.globalAlpha = 0.09;
  ctx.fill();
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = Math.max(1, unit);
  ctx.globalAlpha = 0.14;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(x + inset + dot, middle, dot, 0, Math.PI * 2);
  ctx.fillStyle = theme.accent;
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textX = x + inset + dot * 2 + 8 * unit;
  ctx.font = `500 ${size}px ${font}`;
  ctx.fillStyle = theme.muted;
  ctx.fillText(LEAD, textX, middle);
  ctx.font = `650 ${size}px ${font}`;
  ctx.fillStyle = theme.text;
  ctx.fillText(SITE, textX + lead + space, middle);
};
