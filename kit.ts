import type { Layout, Settings, Visual } from "@drkxbt/audiogram";

/** The look a user keeps between clips: Audiogram's settings, with the picture shrunk to a data URL. */
export type Kit = Partial<Pick<Settings, "title" | "speaker" | "handle" | "layout" | "visual">> & { theme?: number; cover?: string };

const KEY = "soundbite:kit";
const LAYOUTS: Layout[] = ["square", "portrait", "landscape"];
const VISUALS: Visual[] = ["bars", "wave", "pulse"];

/** A saved kit, keeping only fields of the right kind. Anything unreadable is an empty kit; it never throws. */
export function parseKit(raw: string | null): Kit {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "");
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const value = data as Record<string, unknown>;
  const kit: Kit = {};
  for (const field of ["title", "speaker", "handle"] as const) {
    if (typeof value[field] === "string") kit[field] = value[field] as string;
  }
  if (LAYOUTS.includes(value.layout as Layout)) kit.layout = value.layout as Layout;
  if (VISUALS.includes(value.visual as Visual)) kit.visual = value.visual as Visual;
  if (Number.isInteger(value.theme) && (value.theme as number) >= 0) kit.theme = value.theme as number;
  if (typeof value.cover === "string" && value.cover.startsWith("data:image/")) kit.cover = value.cover;
  return kit;
}

// Storage can be full, blocked or missing (a private window); the kit is a convenience, so it fails quietly.
export function loadKit(): Kit {
  try {
    return parseKit(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

export function saveKit(kit: Kit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(kit));
  } catch {
    // Not kept this time; the clip itself is unaffected.
  }
}

/** A picture cut to a centred square and shrunk to `size` pixels, as a JPEG data URL small enough to keep. */
export async function shrinkCover(blob: Blob, size = 256): Promise<string> {
  const image = await createImageBitmap(blob);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}
