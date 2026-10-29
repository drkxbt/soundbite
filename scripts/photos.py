"""Builds the photo library: public-domain (CC0) photos for clip backgrounds, five for each theme, served from the
app's own folder so the editor never loads a picture from another host.

Run from anywhere with `python scripts/photos.py`. It searches an open index of CC0 images, downloads the picks,
writes photos/<id>.webp, photos/thumbs/<id>.webp, photos/photos.json and photos/CREDITS.md, and drops photos an
earlier run wrote that are no longer picked. Search results and downloads are cached in the system's temp folder,
so a rerun after adding an id to EXCLUDED or a name to NAMES is quick and asks the index for nothing new.
"""

import hashlib
import io
import json
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "photos"
CACHE = Path(tempfile.gettempdir()) / "soundbite-photos"

API = "https://api.openverse.org/v1/images/"
AGENT = "soundbite-photos/1.0 (+https://drk.vc/soundbite)"
# The sources searched, best first: a curated photo directory, then the wiki's media library, which is larger but
# mixes in paintings, diagrams and scans. Each is searched on its own, as the directory's few matches are otherwise
# crowded out. The stock photo site is left out: the index links to its 960 px previews, too small to fill 1600 px.
SOURCES = ("wordpress", "wikimedia")

PER_THEME = 5
MIN_WIDTH = 1600
# Landscape, but not so wide that a 16:9 or square clip crops away most of it.
WIDEST, NARROWEST = 2.0, 1.25
FULL_SIDE, FULL_QUALITY, FULL_CAP = 1600, 78, 190_000
THUMB_SIDE, THUMB_QUALITY, THUMB_CAP = 400, 70, 22_000
FOLDER_LIMIT = 9 * 1024 * 1024
LARGEST_DOWNLOAD = 30 * 1024 * 1024

# Each theme's searches, in the order their results take turns, so a theme is not five takes on one search.
THEMES = {
    "Microphone and studio": ["studio microphone", "recording studio", "mixing console"],
    "Headphones and music": ["headphones", "vinyl record", "acoustic guitar"],
    "City at night": ["city night", "night skyline", "city lights"],
    "Nature and landscape": ["mountain landscape", "forest", "lake"],
    "Abstract and texture": ["texture", "bokeh", "wood texture"],
    "Desk and workspace": ["desk", "laptop", "workspace"],
    "Coffee and cosy": ["coffee cup", "coffee", "candle"],
    "Sky and sunset": ["sunset", "clouds sky", "sunrise"],
}

# Words that say a person is the subject. Titles and tags people gave are trusted; tags a machine guessed only
# count when it was sure, as it calls a microphone on an empty stage "people".
PEOPLE = {
    "person", "people", "man", "men", "woman", "women", "girl", "girls", "boy", "boys", "portrait", "face",
    "selfie", "child", "children", "kid", "kids", "couple", "guy", "lady", "model", "adult", "baby", "bride",
    "crowd", "singer", "musician", "dj", "musicians", "player", "performer", "band", "family", "student",
    "guitarist", "drummer", "pianist", "male", "female", "he", "she", "his", "her",
}
SURE = 0.95

# Picks that were looked at and turned down, with why, by the first eight characters of the index's id.
EXCLUDED: dict[str, str] = {
    "d15b364c": "a man is the subject",
    "b3af2150": "a person fills half the frame",
    "3ea42532": "almost all black",
    "c681eb03": "almost all black",
    "58665f42": "a mushroom, not a landscape",
    "1a21fa0e": "artificial turf, and too heavy to encode small",
    "4e8f2fc9": "a cluttered desk",
    "c248a1cd": "a sweet on a laptop, not a workspace",
    "194173d9": "a cat is the subject",
    "d037ea36": "a coffee chain's logo on every cup",
    "1b8f3119": "coffee beans drying in a tunnel, not cosy",
    "dfe2209c": "plants, with the sky behind",
    "87e302cd": "a daytime street view, more city than sky",
    "63049508": "a laptop maker's logo in plain view",
    "c1e678ae": "candles on a shop shelf, labels showing",
    "c5a85728": "a guitarist is the subject",
}

# Plain names for picks whose titles are file names, keyword lists or not in English.
NAMES: dict[str, str] = {
    "d61ed0d3": "Studio microphone in a shock mount",
    "856310fd": "Studio desk with keyboard and mixer",
    "dfc3d8bc": "Mixing console beside studio monitors",
    "b878edc4": "Condenser microphone, close up",
    "4ea1cb20": "Drum microphones in a flight case",
    "ccab8482": "In-ear monitors on a wooden table",
    "1429d24a": "Stack of vinyl records",
    "c2784db9": "Old acoustic guitar covered in signatures",
    "c357fca2": "Headphones with a red cable",
    "dd57d07f": "Black headphones on a desk",
    "4b8f01e2": "London skyline at night",
    "dedfb4cc": "Kathmandu lights at dusk",
    "39b76eed": "Lit riverboat below city towers",
    "2ec6bb82": "Traffic light trails by an overpass",
    "fa834cd7": "Lit tower block at night",
    "d06c8050": "Mountain valley under a clear sky",
    "f3dca96f": "Dense pine forest",
    "c68c792e": "Pine trees over layered blue hills",
    "a549dbd3": "Snowy peaks reflected in a lake",
    "0ab72f10": "Barren mountains under scattered clouds",
    "bff9611c": "White clay wall in fan patterns",
    "c9cff5be": "Green leaves on a soft background",
    "2425f268": "Weathered wooden log",
    "43189648": "Woven nest and golden bokeh",
    "febc9fea": "Worn paint on a wooden door",
    "df211c89": "Code on a monitor between two candles",
    "ba104cc7": "Laptop on a black table in a lounge",
    "8b0f7bf2": "Office desk with code on screen",
    "de0a5561": "Coffee and a laptop in a wood-panelled bar",
    "f98abad6": "Cold drink on a desk beside a monitor",
    "d9bf52d5": "Espresso cup on a stone ledge",
    "7dfb55c2": "Moka pot on a gas stove",
    "e4447ee7": "Two tealights in ribbed glass",
    "324563b0": "Frothy coffee in a white cup",
    "b3f8f8a6": "Two glasses of coffee by an open window",
    "918c355d": "Hazy sun setting over a rocky coast",
    "0ac4069f": "Clouds seen from above",
    "00541370": "Tree against a pink evening sky",
    "f3f7cb43": "Prayer flags at sunrise",
    "79f1d53f": "Orange sunset over the sea",
}


def log(message: str) -> None:
    print(message, flush=True)


def fetch(url: str, timeout: float = 60, attempts: int = 5) -> bytes:
    """The body at url. The index can be slow or time out, so timeouts, server errors and rate limits are tried
    again after a growing wait; any other refusal is final."""
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read(LARGEST_DOWNLOAD + 1)
        except urllib.error.HTTPError as error:
            if (error.code != 429 and error.code < 500) or attempt == attempts - 1:
                raise
            wait = int(error.headers.get("Retry-After") or 0) or 2 ** (attempt + 1)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == attempts - 1:
                raise
            wait = 2 ** (attempt + 1)
        log(f"  retrying in {wait}s: {url[:90]}")
        time.sleep(wait)
    raise RuntimeError("unreachable")


def cached(kind: str, key: str, load) -> bytes:
    path = CACHE / kind / hashlib.sha1(key.encode()).hexdigest()
    if path.exists():
        return path.read_bytes()
    body = load()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return body


def search(query: str, source: str, page: int) -> list[dict]:
    params = {
        "q": query,
        "license": "cc0",
        "source": source,
        # Only wide pictures. Size is checked here instead of asked for, as the index is much slower with that filter.
        "aspect_ratio": "wide",
        "mature": "false",
        "page_size": 20,
        "page": page,
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    try:
        return json.loads(cached("search", url, lambda: fetch(url, timeout=110)))["results"]
    except urllib.error.HTTPError as error:
        log(f"  search '{query}' in {source}, page {page}, failed: {error.code}")
        return []


def shows_people(result: dict) -> bool:
    words = set(re.findall(r"[a-z]+", result.get("title", "").lower()))
    for tag in result.get("tags") or []:
        accuracy = tag.get("accuracy")
        if accuracy is None or accuracy >= SURE:
            words.update(re.findall(r"[a-z]+", tag["name"].lower()))
    return bool(words & PEOPLE)


def landscape(width: int, height: int) -> bool:
    return NARROWEST <= width / height <= WIDEST


def suitable(result: dict) -> bool:
    return (
        result.get("license") == "cc0"
        and not result.get("mature")
        and not result.get("unstable__sensitivity")
        and (result.get("filetype") or "").lower() in ("jpg", "jpeg")
        and (result.get("width") or 0) >= MIN_WIDTH
        and landscape(result.get("width") or 0, result.get("height") or 1)
        and not shows_people(result)
    )


def download_url(result: dict) -> str:
    """The file to download: the original, except that a very large file on the wiki's server is fetched as its
    1920 px rendition, one of the sizes it keeps ready, which is still more than the 1600 px it is cut down to."""
    url = result["url"]
    match = re.match(r"https://upload\.wikimedia\.org/wikipedia/commons/(\w/\w\w)/([^/]+\.jpe?g)$", url, re.I)
    if match and result["width"] > 1920:
        return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{match[1]}/{match[2]}/1920px-{match[2]}"
    return url


def credit(result: dict) -> str:
    name = result.get("creator") or "Unknown"
    # Some names arrive percent-encoded in Latin-1, as "Kai%20Oberh%E4user".
    if re.search(r"%[0-9A-Fa-f]{2}", name):
        name = urllib.parse.unquote(name, encoding="latin-1")
    return re.sub(r"\s+", " ", name).strip()


def plain_name(result: dict) -> str:
    """A stand-in name from the title, for a pick not yet named in NAMES: no markup, file name parts or catalogue
    numbers, no asides in brackets, and only its first sentence, as some titles are a paragraph describing the photo."""
    title = re.sub(r"<[^>]+>", " ", result.get("title") or "")
    title = re.sub(r"^\s*File:|\.(jpe?g|png|tiff?)$|\([^)]*\)|\b\d{5,}\b", "", title, flags=re.I)
    title = re.sub(r"[_\s]+", " ", title.split(". ")[0]).strip(" -,.")
    if len(title) > 60:
        title = title[:60].rsplit(" ", 1)[0]
    return title[:1].upper() + title[1:] if title else "Untitled"


def encode(image: Image.Image, side: int, quality: int, cap: int) -> tuple[bytes, tuple[int, int]]:
    """The picture at `side` px on its long side as WebP, at `quality` or, for a busy picture that would be heavy,
    the highest lower quality that fits under `cap` bytes, so the whole folder stays small. Quality stops at 50, as
    below that the picture shows it; the few that are still over the cap are kept at 50."""
    sized = image.copy()
    sized.thumbnail((side, side), Image.LANCZOS)
    for step in range(quality, 49, -4):
        buffer = io.BytesIO()
        sized.save(buffer, "WEBP", quality=step, method=6)
        if buffer.tell() <= cap:
            break
    return buffer.getvalue(), sized.size


def open_picture(result: dict) -> Image.Image | None:
    url = download_url(result)
    try:
        body = cached("originals", url, lambda: fetch(url, timeout=120))
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        log(f"  skipped {result['id'][:8]}: download failed ({getattr(error, 'code', error)})")
        return None
    if len(body) > LARGEST_DOWNLOAD:
        log(f"  skipped {result['id'][:8]}: file too large")
        return None
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(body)))
        image = image.convert("RGB")
    except Exception as error:
        log(f"  skipped {result['id'][:8]}: unreadable ({error})")
        return None
    width, height = image.size
    if width < MIN_WIDTH or not landscape(width, height):
        log(f"  skipped {result['id'][:8]}: {width}x{height} is too small or not landscape")
        return None
    return image


def candidates(queries: list[str]):
    """Results for a theme, the searches taking turns, best first within each; a second page only when the first
    pages run out."""
    seen = set()
    for page in (1, 2):
        lists = [
            [result for source in SOURCES for result in search(query, source, page) if suitable(result)]
            for query in queries
        ]
        for turn in range(max(map(len, lists), default=0)):
            for results in lists:
                if turn < len(results) and results[turn]["id"] not in seen:
                    seen.add(results[turn]["id"])
                    yield results[turn]


def pick_theme(theme: str, queries: list[str], taken: set[str]) -> list[dict]:
    log(theme)
    # One photo a photographer in each theme, so a theme is not five frames from one shoot.
    picks, creators = [], set()
    for result in candidates(queries):
        short = result["id"][:8]
        who = credit(result)
        if short in taken or short in EXCLUDED or who in creators:
            continue
        image = open_picture(result)
        if image is None:
            continue
        full, size = encode(image, FULL_SIDE, FULL_QUALITY, FULL_CAP)
        thumb, _ = encode(image, THUMB_SIDE, THUMB_QUALITY, THUMB_CAP)
        (OUT / f"{short}.webp").write_bytes(full)
        (OUT / "thumbs" / f"{short}.webp").write_bytes(thumb)
        taken.add(short)
        creators.add(who)
        picks.append({
            "id": short,
            "name": NAMES.get(short) or plain_name(result),
            "theme": theme,
            "file": f"{short}.webp",
            "thumb": f"thumbs/{short}.webp",
            "width": size[0],
            "height": size[1],
            "credit": who,
            "source": result["foreign_landing_url"],
            "licence": "CC0",
        })
        log(f"  {short} {result['source']:<9} {len(full) // 1024:>4} KB  {picks[-1]['name']}")
        if len(picks) == PER_THEME:
            return picks
    raise SystemExit(f"Only {len(picks)} photos found for {theme}; add searches to its list.")


def credits_page(photos: list[dict]) -> str:
    lines = [
        "# Photo credits",
        "",
        "Every photo in this folder is dedicated to the public domain under CC0 1.0",
        "(https://creativecommons.org/publicdomain/zero/1.0/), so it can be used without asking or crediting.",
        "These are the people who took them, and where each one was found.",
    ]
    for theme in THEMES:
        lines += ["", f"## {theme}", ""]
        for photo in (photo for photo in photos if photo["theme"] == theme):
            lines.append(f"- {photo['name']} (`{photo['file']}`), by {photo['credit']}: {photo['source']}")
    return "\n".join(lines) + "\n"


def folder_size(folder: Path) -> int:
    return sum(path.stat().st_size for path in folder.rglob("*") if path.is_file())


def main() -> None:
    # Titles and names come in every script, and a Windows console's code page has few of them.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    (OUT / "thumbs").mkdir(parents=True, exist_ok=True)
    # Each search can take most of a minute, so the first pages are asked for a few at a time up front.
    searches = [(query, source) for queries in THEMES.values() for query in queries for source in SOURCES]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda each: search(*each, 1), searches))
    taken: set[str] = set()
    photos = [photo for theme, queries in THEMES.items() for photo in pick_theme(theme, queries, taken)]
    for folder in (OUT, OUT / "thumbs"):
        for stale in folder.glob("*.webp"):
            if stale.stem not in taken:
                stale.unlink()
    (OUT / "photos.json").write_text(json.dumps(photos, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "CREDITS.md").write_text(credits_page(photos), encoding="utf-8")
    total = folder_size(OUT)
    log(f"{len(photos)} photos, {total / 1024 / 1024:.2f} MB in {OUT}")
    if total >= FOLDER_LIMIT:
        sys.exit(f"The photos folder is {total} bytes, over the {FOLDER_LIMIT} byte limit; lower FULL_CAP.")


if __name__ == "__main__":
    main()
