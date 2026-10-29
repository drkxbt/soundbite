"""Fetches the Humaaans figures for the people drawings: Pablo Stanley's flat SVGs of people standing and sitting, as
a GitHub mirror kept them in 2019 under CC BY 4.0, pinned to one commit so a rerun always brings the same files.

Run from anywhere with `python scripts/humaaans.py`. It writes humaaans/<pose>-<n>.svg, the mirror's licence as
humaaans/LICENSE.md and humaaans/CREDITS.md, and drops SVGs an earlier run wrote that are no longer fetched. The files
are only ever read as text: scripts/drawings.js turns them into path data at build time.
"""

import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "humaaans"

REPO = "Calinou/humaaans"
# The mirror's only commit. Humaaans' own site has since moved the library to CC0, but these files were published
# under CC BY 4.0, so that is the licence they are kept and credited under.
COMMIT = "818f184343b884123e08e531ffd62c5b2f9ffef4"
FOLDER = "Flat Assets/Humaaans"
RAW = f"https://raw.githubusercontent.com/{REPO}/{COMMIT}/"
SOURCE = f"https://github.com/{REPO}/tree/{COMMIT}"
AGENT = "soundbite-humaaans/1.0 (+https://drk.vc/soundbite)"
# The composed figures in the mirror: each pose numbered from one. The single pieces beside them are parts to build
# a figure from, not figures.
POSES = {"standing": 24, "sitting": 8}
# The largest figure is 15 KB; anything far past that is not one of these files.
LARGEST = 200_000


def log(message: str) -> None:
    print(message, flush=True)


def fetch(path: str, attempts: int = 4) -> bytes:
    """The file at path in the pinned commit. Timeouts and server errors are tried again after a growing wait."""
    url = RAW + urllib.parse.quote(path)
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read(LARGEST + 1)
            if len(body) > LARGEST:
                raise SystemExit(f"{path} is over {LARGEST} bytes; the mirror is not what this script expects.")
            return body
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == attempts - 1:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == attempts - 1:
                raise
        wait = 2 ** (attempt + 1)
        log(f"  retrying in {wait}s: {path}")
        time.sleep(wait)
    raise RuntimeError("unreachable")


def figure(path: str) -> bytes:
    body = fetch(path)
    text = body.decode("utf-8")
    if "<svg" not in text[:400] or not text.rstrip().endswith("</svg>"):
        raise SystemExit(f"{path} is not an SVG file.")
    return body


def credits_page(names: list[str]) -> str:
    return "\n".join([
        "# Humaaans credits",
        "",
        "The figures in this folder are Humaaans by Pablo Stanley (https://www.humaaans.com), copyright 2019 Pablo",
        "Stanley, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0,",
        "https://creativecommons.org/licenses/by/4.0/). The full licence is in LICENSE.md.",
        "",
        f"They are the composed figures from the GitHub mirror {REPO}, at commit {COMMIT[:7]}:",
        SOURCE,
        "",
        "The files are kept as the mirror has them. The build redraws each one as plain path data for the editor,",
        "fitted to the box its shapes reach, with the artist's shapes and colours unchanged.",
        "",
        *(f"- `{name}`" for name in names),
        "",
    ])


def main() -> None:
    OUT.mkdir(exist_ok=True)
    names = [f"{pose}-{n}.svg" for pose, count in POSES.items() for n in range(1, count + 1)]
    for name in names:
        (OUT / name).write_bytes(figure(f"{FOLDER}/{name}"))
    for stale in OUT.glob("*.svg"):
        if stale.name not in names:
            stale.unlink()
    (OUT / "LICENSE.md").write_bytes(fetch("LICENSE.md"))
    (OUT / "CREDITS.md").write_text(credits_page(names), encoding="utf-8")
    size = sum(path.stat().st_size for path in OUT.iterdir())
    log(f"{len(names)} figures, {size / 1024:.0f} KB in {OUT}")


if __name__ == "__main__":
    sys.exit(main())
