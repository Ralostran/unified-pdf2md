#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found in PATH. Install Node.js 20+." >&2
  exit 1
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 was not found in PATH." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

"$PYTHON_BIN" apps/gui-python/unified_pdf2md_gui.py
