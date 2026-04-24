#!/usr/bin/env python3
"""
Per-episode OG card generator for Inlet Wire.

Auto-discovers every non-draft episode in src/content/episodes and
composites a 1200x630 branded social card to public/images/og/ep-XX.jpg.

Design: solid black canvas, episode cover on the left, horizontal
wordmark top-right, EP.XX label + artist + title stacked on the right.
Monochrome palette only (brand rule).

Run from repo root:
    pip install Pillow numpy
    python3 scripts/generate-og-cards.py

The existing cover at public/images/episodes/ep-XX-cover.jpg is required.
Missing covers are logged and skipped.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import re
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
EPISODES_DIR = REPO_ROOT / "src" / "content" / "episodes"
PUBLIC = REPO_ROOT / "public"
COVERS_DIR = PUBLIC / "images" / "episodes"
OUT_DIR = PUBLIC / "images" / "og"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOGO_HORIZONTAL = PUBLIC / "logo-horizontal.png"

W, H = 1200, 630
BG = (0, 0, 0)
FG = (255, 255, 255)
MUTED = (170, 170, 170)


# Pick the first available bold/regular sans the machine has installed.
# On macOS, Montserrat/Inter via Font Book will work. On Linux,
# Liberation Sans is a safe default.
FONT_BOLD_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Montserrat-Black.ttf",
    "/Library/Fonts/Montserrat-Black.ttf",
    "/usr/share/fonts/truetype/montserrat/Montserrat-Black.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]
FONT_REG_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Inter.ttc",
    "/Library/Fonts/Inter-Regular.ttf",
    "/usr/share/fonts/truetype/inter/Inter-Regular.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def pick_font(candidates):
    for c in candidates:
        if Path(c).exists():
            return c
    print("ERROR: no font found in candidates:", candidates, file=sys.stderr)
    sys.exit(1)


FONT_BOLD = pick_font(FONT_BOLD_CANDIDATES)
FONT_REG = pick_font(FONT_REG_CANDIDATES)


def load_logo_white(target_height: int) -> Image.Image:
    """Return the horizontal wordmark scaled to target_height. If the
    source artwork is dark, invert the RGB so it reads white on black."""
    logo = Image.open(LOGO_HORIZONTAL).convert("RGBA")
    try:
        import numpy as np
        arr = np.array(logo)
        mask = arr[:, :, 3] > 16
        avg = arr[:, :, :3][mask].mean() if mask.any() else 0
        if avg < 128:
            inv = arr.copy()
            inv[:, :, 0] = 255 - inv[:, :, 0]
            inv[:, :, 1] = 255 - inv[:, :, 1]
            inv[:, :, 2] = 255 - inv[:, :, 2]
            logo = Image.fromarray(inv, mode="RGBA")
    except ImportError:
        pass  # numpy optional; on macOS the bundled logo may already be white

    w, h = logo.size
    ratio = target_height / h
    return logo.resize((int(w * ratio), target_height), Image.LANCZOS)


def fit_cover(cover_path: Path, size: int) -> Image.Image:
    im = Image.open(cover_path).convert("RGB")
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    return im.resize((size, size), Image.LANCZOS)


def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines, current = [], []
    for w in words:
        trial = " ".join(current + [w])
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current.append(w)
        else:
            if current:
                lines.append(" ".join(current))
            current = [w]
    if current:
        lines.append(" ".join(current))
    return lines


def make_card(ep_num: int, artist: str, title: str):
    cover_src = COVERS_DIR / f"ep-{ep_num:02d}-cover.jpg"
    if not cover_src.exists():
        print(f"  skip ep-{ep_num:02d}: cover missing ({cover_src.name})")
        return

    card = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(card)

    # Left: cover
    cover_size = 480
    cover = fit_cover(cover_src, cover_size)
    cover_x = 75
    cover_y = (H - cover_size) // 2
    card.paste(cover, (cover_x, cover_y))

    # Right column geometry
    right_x = cover_x + cover_size + 60
    right_w = W - right_x - 60

    # Top-right wordmark
    logo = load_logo_white(64)
    card.paste(logo, (W - logo.size[0] - 60, 50), logo)

    # EP. XX label
    label_font = ImageFont.truetype(FONT_BOLD, 22)
    label_y = cover_y
    draw.text((right_x, label_y), f"EP. {ep_num:02d}", font=label_font, fill=MUTED)

    # Artist (auto-shrink to fit)
    artist_size = 72
    while artist_size > 40:
        f = ImageFont.truetype(FONT_BOLD, artist_size)
        bbox = draw.textbbox((0, 0), artist, font=f)
        if bbox[2] - bbox[0] <= right_w:
            break
        artist_size -= 4
    artist_font = ImageFont.truetype(FONT_BOLD, artist_size)
    artist_y = label_y + 40
    draw.text((right_x, artist_y), artist, font=artist_font, fill=FG)
    abox = draw.textbbox((0, 0), artist, font=artist_font)
    artist_h = abox[3] - abox[1]

    # Title (wrapped)
    title_font = ImageFont.truetype(FONT_REG, 34)
    title_y = artist_y + artist_h + 24
    for line in wrap_text(title, title_font, right_w, draw):
        draw.text((right_x, title_y), line, font=title_font, fill=FG)
        lbox = draw.textbbox((0, 0), line, font=title_font)
        title_y += (lbox[3] - lbox[1]) + 8

    # URL + peaks divider
    url_font = ImageFont.truetype(FONT_REG, 20)
    draw.text((right_x, H - 70), "inletwire.com", font=url_font, fill=MUTED)
    draw.line([(right_x, H - 90), (right_x + 60, H - 90)], fill=FG, width=2)

    out_path = OUT_DIR / f"ep-{ep_num:02d}.jpg"
    card.save(out_path, format="JPEG", quality=85, optimize=True, progressive=True)
    kb = out_path.stat().st_size / 1024
    print(f"  wrote ep-{ep_num:02d}.jpg ({kb:.0f} KB) — {artist} / {title}")


FM_RE = re.compile(r"^---\n(.*?)\n---", re.S)


def parse_frontmatter(text: str) -> dict:
    m = FM_RE.match(text)
    if not m:
        return {}
    out = {}
    for line in m.group(1).splitlines():
        mm = re.match(r'^(\w+):\s*"?(.*?)"?\s*$', line)
        if mm:
            out[mm.group(1)] = mm.group(2)
    return out


def discover_episodes():
    eps = []
    seen_numbers = set()
    for md in sorted(EPISODES_DIR.glob("*.md")):
        data = parse_frontmatter(md.read_text(encoding="utf-8"))
        if data.get("draft", "false").lower() == "true":
            continue
        try:
            num = int(data.get("episode_number", "0"))
        except ValueError:
            continue
        if num <= 0 or num >= 900:
            continue
        if num in seen_numbers:
            continue
        seen_numbers.add(num)
        eps.append((num, data.get("artist", ""), data.get("title", "")))
    return sorted(eps, key=lambda t: t[0])


def main():
    eps = discover_episodes()
    print(f"Generating OG cards into {OUT_DIR.relative_to(REPO_ROOT)}")
    print(f"Using bold font: {FONT_BOLD}")
    print(f"Using regular font: {FONT_REG}")
    print()
    for num, artist, title in eps:
        make_card(num, artist, title)
    print(f"\nDone. {len(eps)} episodes processed.")


if __name__ == "__main__":
    main()
