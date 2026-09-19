#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(grep -o '"version": *"[^"]*"' "${ROOT_DIR}/manifest.json" | cut -d'"' -f4)
OUT_DIR="${ROOT_DIR}/dist"
ZIP_NAME="youtube-live-recorder-v${VERSION}.zip"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cd "$ROOT_DIR"
zip -r "${OUT_DIR}/${ZIP_NAME}" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "dist/*" \
  -x "scripts/*" \
  -x "*.md" \
  -x "README*" \
  -x "LICENSE*" \
  -x "*.sh" \
  -x "node_modules/*" \
  -x ".vscode/*"

echo "Created ${OUT_DIR}/${ZIP_NAME}"
ls -lh "${OUT_DIR}/${ZIP_NAME}"