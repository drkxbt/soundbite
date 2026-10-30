/* The podcast templates the picker offers: twelve newer looks that move (a background that drifts and swells with the
   voice, words that come in as they are said, small parts that pulse, float or turn), each in a file of its own under
   designs/, then the twenty-four originals from classic-templates.ts. All are built with the kit in template-kit.ts,
   laid out for every frame shape the editor offers, and only layers, so once one is picked every part of it can be
   moved, restyled or deleted. */
import type { Layer, Layout, Page } from "@drkxbt/audiogram";
import { CLASSIC_TEMPLATES, nightGlass } from "./classic-templates.js";
import type { TemplateChoice } from "./template-kit.js";
import { auroraGlass } from "./designs/aurora-glass.js";
import { neonStudio } from "./designs/neon-studio.js";
import { liquidFlow } from "./designs/liquid-flow.js";
import { bokehNight } from "./designs/bokeh-night.js";
import { broadcast } from "./designs/broadcast.js";
import { vinyl } from "./designs/vinyl.js";
import { magazine } from "./designs/magazine.js";
import { terminal } from "./designs/terminal.js";
import { stardust } from "./designs/stardust.js";
import { spotlight } from "./designs/spotlight.js";
import { waveform } from "./designs/waveform.js";
import { daylight } from "./designs/daylight.js";

export type { TemplateChoice } from "./template-kit.js";

/** The newer looks, first in the picker. */
const MOVING_TEMPLATES: TemplateChoice[] = [auroraGlass, neonStudio, liquidFlow, bokehNight, broadcast, vinyl, magazine, terminal, stardust, spotlight, waveform, daylight];

/** The podcast templates in the order the picker shows them. */
export const PODCAST_TEMPLATES: TemplateChoice[] = [...MOVING_TEMPLATES, ...CLASSIC_TEMPLATES];

/** The design a first visit opens on: Night Glass on every shape, so the clip looks finished before anything is
 *  picked and every part of it is there to change. */
export function firstDesign(): { layers: Record<Layout, Layer[]>; page: Page | null; theme?: number } {
  const layouts: Layout[] = ["square", "portrait", "story", "landscape"];
  const made = nightGlass.make("square");
  return { layers: Object.fromEntries(layouts.map((layout) => [layout, nightGlass.make(layout).layers])) as Record<Layout, Layer[]>, page: made.page, theme: made.theme };
}
