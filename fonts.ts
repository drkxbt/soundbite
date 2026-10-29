/* The fonts Soundbite offers in its editor, for English text: open-licence, bundled with the app so nothing is
   fetched from a font service, and shipped with their Latin letters only. The build reads each package's own CSS for
   its files and Unicode ranges and writes fonts/fonts.json next to the app. */

export type FontCategory = "Sans" | "Serif" | "Display" | "Handwriting" | "Mono";

export interface FontSpec {
  /** The Fontsource id: the package is @fontsource-variable/<id> when `variable`, else @fontsource/<id>. */
  id: string;
  name: string;
  category: FontCategory;
  variable: boolean;
}

const font = (id: string, name: string, category: FontCategory, variable = false): FontSpec => ({ id, name, category, variable });

export const FONTS: FontSpec[] = [
  font("inter", "Inter", "Sans", true),
  font("montserrat", "Montserrat", "Sans", true),
  font("poppins", "Poppins", "Sans"),
  font("dm-sans", "DM Sans", "Sans", true),
  font("outfit", "Outfit", "Sans", true),
  font("space-grotesk", "Space Grotesk", "Sans", true),
  font("bricolage-grotesque", "Bricolage Grotesque", "Sans", true),
  font("raleway", "Raleway", "Sans", true),
  font("league-spartan", "League Spartan", "Sans", true),
  font("archivo", "Archivo", "Sans", true),
  font("nunito", "Nunito", "Sans", true),
  font("fredoka", "Fredoka", "Sans", true),
  font("syne", "Syne", "Sans", true),
  font("oswald", "Oswald", "Display", true),
  font("anton", "Anton", "Display"),
  font("bebas-neue", "Bebas Neue", "Display"),
  font("archivo-black", "Archivo Black", "Display"),
  font("unbounded", "Unbounded", "Display", true),
  font("alfa-slab-one", "Alfa Slab One", "Display"),
  font("righteous", "Righteous", "Display"),
  font("bungee", "Bungee", "Display"),
  font("shrikhand", "Shrikhand", "Display"),
  font("luckiest-guy", "Luckiest Guy", "Display"),
  font("black-ops-one", "Black Ops One", "Display"),
  font("monoton", "Monoton", "Display"),
  font("press-start-2p", "Press Start 2P", "Display"),
  font("playfair-display", "Playfair Display", "Serif", true),
  font("dm-serif-display", "DM Serif Display", "Serif"),
  font("abril-fatface", "Abril Fatface", "Serif"),
  font("bodoni-moda", "Bodoni Moda", "Serif", true),
  font("instrument-serif", "Instrument Serif", "Serif"),
  font("cormorant-garamond", "Cormorant Garamond", "Serif", true),
  font("libre-baskerville", "Libre Baskerville", "Serif"),
  font("cinzel", "Cinzel", "Serif", true),
  font("roboto-slab", "Roboto Slab", "Serif", true),
  font("cinzel-decorative", "Cinzel Decorative", "Serif"),
  font("italiana", "Italiana", "Serif"),
  font("marcellus", "Marcellus", "Serif"),
  font("prata", "Prata", "Serif"),
  font("gilda-display", "Gilda Display", "Serif"),
  font("tenor-sans", "Tenor Sans", "Sans"),
  font("poiret-one", "Poiret One", "Display"),
  font("limelight", "Limelight", "Display"),
  font("pinyon-script", "Pinyon Script", "Handwriting"),
  font("parisienne", "Parisienne", "Handwriting"),
  font("dancing-script", "Dancing Script", "Handwriting", true),
  font("pacifico", "Pacifico", "Handwriting"),
  font("caveat", "Caveat", "Handwriting", true),
  font("permanent-marker", "Permanent Marker", "Handwriting"),
  font("lobster", "Lobster", "Handwriting"),
  font("great-vibes", "Great Vibes", "Handwriting"),
  font("satisfy", "Satisfy", "Handwriting"),
  font("kalam", "Kalam", "Handwriting"),
  font("shantell-sans", "Shantell Sans", "Handwriting", true),
  font("jetbrains-mono", "JetBrains Mono", "Mono", true),
  font("space-mono", "Space Mono", "Mono"),
  font("courier-prime", "Courier Prime", "Mono"),
];

/** One file of a font: the weights it covers (one, or a range for a variable font) and the characters it holds. */
export interface FontFile {
  file: string;
  weight: string;
  unicodeRange: string;
}

/** A font as fonts/fonts.json lists it. */
export interface FontEntry {
  name: string;
  category: FontCategory;
  family: string;
  files: FontFile[];
}
