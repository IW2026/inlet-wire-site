#!/usr/bin/env bash
# make-gallery-webp.sh
# Converts episode gallery JPGs to WebP alongside the originals.
# Run from the site root: bash scripts/make-gallery-webp.sh
#
# Requires: cwebp (brew install webp)
#
# Usage: bash scripts/make-gallery-webp.sh
#   Converts all ep-*-gallery-*.jpg in public/images/episodes/

set -euo pipefail

EPISODES_DIR="public/images/episodes"

if ! command -v cwebp &>/dev/null; then
  echo "❌  cwebp not found. Install with: brew install webp"
  exit 1
fi

count=0
for jpg in "$EPISODES_DIR"/ep-*-gallery-*.jpg; do
  [ -f "$jpg" ] || continue
  webp="${jpg%.jpg}.webp"
  cwebp -q 82 "$jpg" -o "$webp"
  echo "✓  $webp"
  (( count++ ))
done

if [ "$count" -eq 0 ]; then
  echo "No gallery JPGs found in $EPISODES_DIR"
else
  echo "Done — $count WebP file(s) created."
fi
