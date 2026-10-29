import type { Overlay } from "@drkxbt/audiogram";

export const CREDIT = "made with drk.vc/engines/soundbite";
const LEAD = "made with";
const SITE = "drk.vc/engines/soundbite";

/**
 * "made with drk.vc/engines/soundbite" as a small label in the top right corner of every frame: light words on a dark
 * chip of its own, so it reads on any page, picture or video behind it, whatever the theme. It sits in the margin
 * Audiogram leaves above the header in every shape, so it never covers the classic card's name, visual or captions.
 */
export const credit: Overlay = (ctx, { width, height, unit, font }) => {
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
  ctx.fillStyle = "rgba(17, 17, 17, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = Math.max(1, unit);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + inset + dot, middle, dot, 0, Math.PI * 2);
  ctx.fillStyle = "#2ff0b8";
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textX = x + inset + dot * 2 + 8 * unit;
  ctx.font = `500 ${size}px ${font}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fillText(LEAD, textX, middle);
  ctx.font = `650 ${size}px ${font}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(SITE, textX + lead + space, middle);
};
