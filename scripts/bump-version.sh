#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/manifest.json"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <major|minor|patch|X.Y.Z>"
  exit 1
fi

CURRENT=$(grep -o '"version": *"[^"]*"' "$MANIFEST" | cut -d'"' -f4)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$1" in
  major) ((MAJOR++)); MINOR=0; PATCH=0 ;;
  minor) ((MINOR++)); PATCH=0 ;;
  patch) ((PATCH++)) ;;
  *.*.*) MAJOR=$(echo "$1" | cut -d. -f1); MINOR=$(echo "$1" | cut -d. -f2); PATCH=$(echo "$1" | cut -d. -f3) ;;
  *) echo "Invalid version: $1"; exit 1 ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"
sed -i "s/\"version\": *\"${CURRENT}\"/\"version\": \"${NEW}\"/" "$MANIFEST"

echo "Bumped $CURRENT -> $NEW"

cd "$ROOT_DIR"
git add manifest.json
git commit -m "chore: release v${NEW}"
git tag "v${NEW}"
git push
git push --tags
echo "Pushed v${NEW}"