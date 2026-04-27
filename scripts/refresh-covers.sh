#!/usr/bin/env bash
# refresh-covers.sh
# Downloads episode cover art from Anchor's CDN, resizes to 1000x1000,
# saves as high-quality JPEG (q=92) + WebP (q=90) using Lanczos resampling.
# Run from the site/ directory:  bash scripts/refresh-covers.sh

set -euo pipefail

DEST="public/images/episodes"
TMP=$(mktemp -d)
TARGET=1000

# ── Dependency check ──────────────────────────────────────────────────────────
if ! python3 -c "from PIL import Image" 2>/dev/null; then
  echo "Installing Pillow..."
  pip3 install --quiet Pillow
fi

url_for() {
  case "$1" in
    01) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1770636132893-44d3d474a824c.jpg" ;;
    02) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1770696863549-3014d1fa85f6d.jpg" ;;
    03) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1771208982599-564549e7bb0bc.jpg" ;;
    04) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1771552997590-3206398ec29b8.jpg" ;;
    05) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1771517509458-914f57b8aadaa.jpg" ;;
    06) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1773046631077-6e5c22c774dc7.jpg" ;;
    07) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1773610600641-b733d83251d9c.jpg" ;;
    08) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1774256655383-65d1617e6e0be.jpg" ;;
    09) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1774863036347-af7781bf9e418.jpg" ;;
    10) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1775208421395-1f7223dc28833.jpg" ;;
    11) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1776072742365-0dedb70bd3e43.jpg" ;;  # Tobacco Brown
    12) echo "https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_episode/45345163/45345163-1776726756457-0e083b91e2e63.jpg" ;;
  esac
}

echo "Refreshing episode covers → $DEST (target: ${TARGET}x${TARGET})"
echo ""

for EP in 01 02 03 04 05 06 07 08 09 10 11 12; do
  URL=$(url_for "$EP")
  RAW="$TMP/ep-${EP}-raw.jpg"
  JPG="$DEST/ep-${EP}-cover.jpg"
  WEBP="$DEST/ep-${EP}-cover.webp"

  printf "Ep %s  downloading..." "$EP"
  curl -sSL --max-time 30 "$URL" -o "$RAW"

  python3 - "$RAW" "$JPG" "$WEBP" "$TARGET" <<'PYEOF'
import sys
from PIL import Image

raw, jpg_out, webp_out, target = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])

img = Image.open(raw)
w, h = img.size

if img.mode != "RGB":
    img = img.convert("RGB")

print(f"  {w}x{h}", end="")

# Support both Pillow <10 and >=10
try:
    resample = Image.Resampling.LANCZOS   # Pillow >= 10
except AttributeError:
    resample = Image.LANCZOS              # Pillow < 10

img = img.resize((target, target), resample)

# JPEG fallback — q=92, no chroma subsampling
img.save(jpg_out, "JPEG", quality=92, subsampling=0, optimize=True)

# WebP — q=90, method=6 (slowest/best encoder)
img.save(webp_out, "WEBP", quality=90, method=6)

import os
j  = os.path.getsize(jpg_out)  // 1024
wk = os.path.getsize(webp_out) // 1024
print(f"  →  {target}x{target}  jpg {j}KB  webp {wk}KB")
PYEOF

done

rm -rf "$TMP"

echo ""
echo "Done. Run  npm run build  to rebuild the site."
