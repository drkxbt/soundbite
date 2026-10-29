// The 3D section of Elements: 3dicons by Vijay Verma, rendered in Blender and given to the public domain (CC0), one
// colourful angle of each icon, written at build time as see-through WebP with an index the app searches. Served from
// the app's own folder so the editor never loads a picture from another host.
//
// Source: https://github.com/realvjy/3dicons (CC0 1.0 in its LICENSE; its about page says the same). The renders are
// the "color" style at the "dynamic" angle, from the CDN its metadata (content/3dicons-meta/*.md) links each icon to.
// Each download is kept in the system's temp folder, so only the first build asks the CDN for anything.
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const CDN = "https://3dicons.sgp1.cdn.digitaloceanspaces.com/v1/dynamic/color/";
const CACHE = join(tmpdir(), "soundbite-3dicons");
// The renders are 400 px squares; they are kept at that size, as enlarging them would add bytes and no detail.
const SIDE = 400;
const QUALITY = 84;
const DOWNLOADS_AT_ONCE = 8;

export const CREDIT = "3D icons by 3dicons, CC0";
export const SITE = "https://3dicons.co/";

/**
 * The icons kept, in the order an empty search shows them: what a podcast or a social clip reaches for first, then the
 * rest. Each is [id, name, tags, the file's name on the CDN when it isn't the id]. The project's own Blender, Figma
 * and Minecraft logos are left out, being other companies' marks.
 */
export const OBJECTS = [
  ["microphone", "Microphone", ["mic", "podcast", "record", "voice", "studio", "sing"], "mic"],
  ["headphones", "Headphones", ["listen", "audio", "podcast", "music", "sound"], "headphone"],
  ["speech-bubble", "Speech bubble", ["chat", "message", "comment", "talk", "say"], "chat"],
  ["chat-bubbles", "Chat bubbles", ["chat", "message", "conversation", "talk", "dm", "reply"], "chat-bubble"],
  ["chat-message", "Chat message", ["chat", "text", "message", "comment", "quote", "transcript"], "chat-text"],
  ["heart", "Heart", ["love", "like", "favourite", "care"]],
  ["like-notification", "Like notification", ["heart", "like", "notify", "love", "reaction", "social"], "notify-heart"],
  ["fire", "Fire", ["hot", "flame", "lit", "trending", "hype"]],
  ["star", "Star", ["favourite", "rating", "best", "review", "shine"]],
  ["trophy", "Trophy", ["winner", "award", "cup", "champion", "prize"]],
  ["crown", "Crown", ["king", "queen", "winner", "best", "vip", "top"], "crow"],
  ["rocket", "Rocket", ["launch", "startup", "growth", "space", "fast", "moon"]],
  ["lightning", "Lightning", ["flash", "bolt", "energy", "fast", "power", "zap"], "flash"],
  ["megaphone", "Megaphone", ["announcement", "shout", "loud", "promo", "news"]],
  ["play", "Play", ["player", "start", "video", "watch"]],
  ["music-note", "Music note", ["music", "song", "sound", "tune", "audio"], "music"],
  ["camera", "Camera", ["photo", "picture", "snap", "photography"]],
  ["video-camera", "Video camera", ["video", "record", "film", "vlog", "camera"]],
  ["calendar", "Calendar", ["date", "schedule", "event", "episode", "release", "day"], "calender"],
  ["gift", "Gift", ["present", "giveaway", "birthday", "surprise", "prize"]],
  ["money-bag", "Money bag", ["money", "rich", "savings", "wealth", "sack"]],
  ["cash", "Banknote", ["money", "cash", "dollar", "pay", "bill"], "money"],
  ["coin", "Coin", ["money", "gold", "token", "crypto", "currency", "earn"], "3d-coin"],
  ["dollar-coin", "Dollar coin", ["money", "usd", "cash", "price", "income"], "dollar"],
  ["thumbs-up", "Thumbs up", ["like", "good", "yes", "agree", "approve", "hand"], "thumb-up"],
  ["thumbs-down", "Thumbs down", ["dislike", "bad", "no", "disagree", "hand"], "thumb-down"],
  ["light-bulb", "Light bulb", ["idea", "tip", "insight", "think", "bright"], "bulb"],
  ["target", "Target", ["goal", "aim", "bullseye", "focus", "dart"]],
  ["medal", "Medal", ["award", "winner", "prize", "badge", "best"]],
  ["check-mark", "Check mark", ["tick", "done", "yes", "correct", "approved"], "tick"],
  ["envelope", "Envelope", ["mail", "email", "letter", "newsletter", "inbox"], "mail"],
  ["at-sign", "At sign", ["email", "mention", "handle", "contact", "@"], "at"],
  ["link", "Link", ["chain", "url", "connect", "share"]],
  ["wifi", "Wi-Fi", ["wifi", "signal", "internet", "online", "connection", "live"]],
  ["phone", "Mobile phone", ["mobile", "smartphone", "screen", "app"], "mobile"],
  ["ringing-phone", "Ringing phone", ["phone", "call", "ring", "hotline"], "phone-ringing"],
  ["computer", "Computer", ["desktop", "monitor", "screen", "work", "pc"]],
  ["picture", "Picture", ["photo", "image", "gallery", "landscape"]],
  ["pushpin", "Pushpin", ["pin", "pinned", "note", "board", "important"], "pin"],
  ["map-pin", "Map pin", ["location", "place", "map", "here", "venue"]],
  ["magnifier", "Magnifying glass", ["search", "zoom", "find", "look", "explore"], "zoom"],
  ["alarm-clock", "Alarm clock", ["time", "clock", "wake", "morning", "deadline"], "clock"],
  ["pie-chart", "Pie chart", ["chart", "stats", "data", "analytics", "share"], "chart"],
  ["mug", "Mug", ["coffee", "tea", "cup", "morning", "drink"], "cup"],
  ["coffee-to-go", "Coffee to go", ["coffee", "takeaway", "cup", "morning", "cafe"], "takeaway-cup"],
  ["teacup", "Teacup", ["tea", "cup", "hot", "drink", "chat"], "tea-cup"],
  ["wine-glass", "Wine glass", ["wine", "cheers", "drink", "celebrate", "toast"], "glass"],
  ["magic-hat", "Magic hat", ["magic", "trick", "wizard", "surprise"], "magic-trick"],
  ["shield", "Shield", ["security", "safe", "protect", "verified", "trust"], "sheild"],
  ["padlock", "Padlock", ["lock", "secure", "private", "safety", "closed"], "lock"],
  ["key", "Key", ["unlock", "access", "secret", "password"]],
  ["moon", "Moon", ["night", "sleep", "dark", "crescent"]],
  ["sun", "Sun", ["sunny", "summer", "day", "weather", "bright", "morning"]],
  ["umbrella", "Umbrella", ["rain", "weather", "cover", "protect"]],
  ["suitcase", "Suitcase", ["travel", "trip", "luggage", "holiday", "business"], "travel"],
  ["shopping-bag", "Shopping bag", ["shop", "store", "merch", "buy", "sale"], "bag"],
  ["credit-card", "Credit card", ["payment", "pay", "money", "buy", "card"], "card"],
  ["wallet", "Wallet", ["money", "pay", "cash", "purse", "crypto"]],
  ["safe", "Safe", ["locker", "vault", "savings", "secure", "money"], "locker"],
  ["dumbbell", "Dumbbell", ["gym", "fitness", "workout", "strength", "health"], "gym"],
  ["puzzle-piece", "Puzzle piece", ["puzzle", "solve", "fit", "game", "piece"], "puzzle"],
  ["chess-pawn", "Chess pawn", ["chess", "strategy", "game", "plan"], "chess"],
  ["flask", "Flask", ["lab", "science", "experiment", "chemistry", "potion"], "lab"],
  ["compass", "Compass", ["explore", "travel", "direction", "navigate", "adventure"], "explorer"],
  ["navigation-arrow", "Navigation arrow", ["location", "direction", "cursor", "send", "gps"], "location"],
  ["flag", "Flag", ["goal", "finish", "milestone", "report"]],
  ["pause", "Pause", ["player", "stop", "break", "hold"]],
  ["fast-forward", "Fast forward", ["forward", "player", "skip", "speed"], "forward"],
  ["rewind", "Rewind", ["backward", "player", "back"], "backward"],
  ["skip-forward", "Skip forward", ["next", "player", "forward"], "next"],
  ["skip-back", "Skip back", ["back", "previous", "player", "start"], "back"],
  ["notebook", "Notebook", ["notes", "book", "journal", "diary", "write"]],
  ["pencil", "Pencil", ["write", "edit", "draw", "note"]],
  ["scissors", "Scissors", ["cut", "clip", "trim", "edit", "craft"], "scissor"],
  ["palette", "Colour palette", ["color", "colour", "paint", "art", "design"], "color-palette"],
  ["paint-kit", "Paint set", ["palette", "art", "brush", "colours", "creative"]],
  ["paintbrush", "Paintbrush", ["art", "paint", "creative", "design"], "paint-brush"],
  ["brush", "Brush", ["paint", "art", "design", "creative"]],
  ["paint-roller", "Paint roller", ["paint", "roller", "decorate", "diy"], "roll-brush"],
  ["paint-bucket", "Paint bucket", ["paint", "colour", "fill", "diy"], "bucket"],
  ["eyedropper", "Eyedropper", ["colour", "picker", "pipette", "design"]],
  ["letter-t", "Letter T", ["text", "type", "font", "typography"], "text"],
  ["3d-letters", "3D letters", ["3d", "text", "three", "dimensional"], "3d"],
  ["man", "Man", ["person", "guest", "host", "user", "avatar", "boy"], "boy"],
  ["woman", "Woman", ["person", "guest", "host", "user", "avatar", "girl"], "girl"],
  ["telephone", "Telephone", ["phone", "call", "handset", "contact"], "phone-only"],
  ["incoming-call", "Incoming call", ["phone", "call", "ring", "answer"], "phone-incoming"],
  ["outgoing-call", "Outgoing call", ["phone", "call", "dial"], "phone-outgoing"],
  ["missed-call", "Missed call", ["phone", "call", "missed"], "phone-missing"],
  ["call-ended", "Call ended", ["phone", "hang", "call", "decline"], "phone-end"],
  ["euro-coin", "Euro coin", ["money", "eur", "cash", "price"], "euro"],
  ["pound-coin", "Pound coin", ["money", "gbp", "cash", "price", "sterling"], "pound"],
  ["yuan-coin", "Yuan coin", ["money", "cny", "yen", "cash"], "yuan"],
  ["rupee-coin", "Rupee coin", ["money", "inr", "cash", "india"], "rupee"],
  ["ether-coin", "Ether coin", ["ethereum", "crypto", "eth", "web3", "token"], "eth"],
  ["calculator", "Calculator", ["math", "numbers", "finance", "budget"]],
  ["battery", "Battery", ["power", "energy", "charge", "full"]],
  ["gear", "Gear", ["settings", "cog", "setup", "tools", "options"], "setting"],
  ["tools", "Tools", ["tool", "screwdriver", "wrench", "fix", "build", "repair"], "tool"],
  ["toggle", "Toggle switch", ["switch", "on", "off", "setting"]],
  ["plus", "Plus", ["add", "new", "more", "cross", "positive"]],
  ["bin", "Bin", ["trash", "delete", "rubbish", "garbage", "can"], "trash-can"],
  ["drink-can", "Drink can", ["soda", "can", "drink", "beverage"], "can"],
  ["axe", "Axe", ["tool", "chop", "wood", "cut"]],
  ["circle", "Circle", ["shape", "round", "dot", "disc"]],
  ["sphere", "Sphere", ["ball", "orb", "round", "shape"]],
  ["cube", "Cube", ["shape", "box", "block", "3d"]],
  ["bookmark", "Bookmark", ["save", "later", "ribbon"]],
  ["bookmark-star", "Starred bookmark", ["save", "favourite", "star"], "bookmark-fav"],
  ["documents", "Documents", ["copy", "paper", "notes", "files"], "copy"],
  ["file", "File", ["document", "page", "paper"]],
  ["text-file", "Text file", ["document", "notes", "transcript", "script", "page"], "file-text"],
  ["new-file", "New file", ["document", "add", "plus", "create"], "file-plus"],
  ["starred-file", "Starred file", ["document", "favourite", "star"], "file-fav"],
  ["folder", "Folder", ["files", "archive", "organise"]],
  ["new-folder", "New folder", ["folder", "add", "plus", "create"]],
  ["starred-folder", "Starred folder", ["folder", "favourite", "saved", "star"], "fav-folder"],
];

const LICENSE = `3D icons in this folder: 3dicons by Vijay Verma (https://3dicons.co/), from
https://github.com/realvjy/3dicons, dedicated to the public domain under CC0 1.0 Universal:
https://creativecommons.org/publicdomain/zero/1.0/

They may be used, changed and shared for any purpose, commercial or not, without asking and
without credit. Soundbite credits them anyway. Each is the "color" render at the "dynamic"
angle, converted to WebP.
`;

/** An icon's render, from the cache or else the CDN; null when it can't be had. */
async function render(file) {
  const cached = join(CACHE, `${file}-dynamic-color.png`);
  if (existsSync(cached)) return readFile(cached);
  try {
    const response = await fetch(`${CDN}${file}-dynamic-color.png`);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(CACHE, { recursive: true });
    await writeFile(cached, bytes);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Writes outDir/<id>.webp for each icon, outDir/index.json (id, name, tags, file, width, height for each, in OBJECTS'
 * order) and outDir/LICENSE.txt. Cleared first, so an icon since dropped isn't left behind. An icon that can't be
 * downloaded is left out and named in `missing`, so a build without the network still finishes.
 */
export async function writeObjects3d(outDir) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const written = new Array(OBJECTS.length);
  let bytes = 0;
  for (let start = 0; start < OBJECTS.length; start += DOWNLOADS_AT_ONCE) {
    await Promise.all(OBJECTS.slice(start, start + DOWNLOADS_AT_ONCE).map(async ([id, name, tags, from = id], offset) => {
      const source = await render(from);
      if (!source) return;
      const { data, info } = await sharp(source)
        .resize(SIDE, SIDE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: QUALITY, alphaQuality: 90, effort: 6 })
        .toBuffer({ resolveWithObject: true });
      const file = `${id}.webp`;
      await writeFile(join(outDir, file), data);
      bytes += data.length;
      written[start + offset] = { id, name, tags, file, width: info.width, height: info.height };
    }));
  }
  const index = written.filter(Boolean);
  await writeFile(join(outDir, "index.json"), JSON.stringify(index));
  await writeFile(join(outDir, "LICENSE.txt"), LICENSE);
  return { count: index.length, bytes, missing: OBJECTS.filter((_, at) => !written[at]).map(([id]) => id) };
}
