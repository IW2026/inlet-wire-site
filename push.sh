#!/usr/bin/env bash
# push.sh — clear stale git locks, stage all changes, commit and push.
# Usage:  bash push.sh "your commit message"

set -euo pipefail

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: bash push.sh \"commit message\""
  exit 1
fi

cd "$(dirname "$0")"

# Clear any stale locks left by background processes
rm -f .git/HEAD.lock .git/index.lock

git add -A
git commit -m "$MSG"
git push origin main

echo ""
echo "Done — committed and pushed."
