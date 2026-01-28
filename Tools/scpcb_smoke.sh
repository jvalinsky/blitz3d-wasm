#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCPCB_DIR="${SCPCB_DIR:-"$REPO_ROOT/../scpcb"}"

# Use a writable HOME/cache for SwiftPM in restricted environments.
SCPCB_SMOKE_HOME="${SCPCB_SMOKE_HOME:-/tmp/blitz3d-wasm-home}"
SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH="${SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH:-$SCPCB_SMOKE_HOME/clang-module-cache}"

if [[ ! -d "$SCPCB_DIR" ]]; then
  echo "SCPCB_DIR not found: $SCPCB_DIR"
  echo "Set SCPCB_DIR=/path/to/scpcb (expected sibling ../scpcb in your setup)."
  exit 2
fi

cd "$REPO_ROOT"

echo "Building compiler..."
HOME="$SCPCB_SMOKE_HOME" CLANG_MODULE_CACHE_PATH="$SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH" \
  swift build --disable-sandbox -q

compile_and_validate() {
  local input="$1"
  local out="/tmp/$(basename "${input%.*}")_smoke.wasm"
  echo "Compiling: $input"
  HOME="$SCPCB_SMOKE_HOME" CLANG_MODULE_CACHE_PATH="$SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH" \
    .build/debug/blitz3d-wasm "$input" -o "$out" --quiet
  if ! command -v deno >/dev/null 2>&1; then
    echo "deno not found. Install Deno to run WebAssembly validation."
    exit 3
  fi
  deno run --quiet --allow-read "$REPO_ROOT/Tools/wasm_validate.ts" "$out"
  echo "OK: $out"
}

compile_and_validate "$SCPCB_DIR/Items.bb"
compile_and_validate "$SCPCB_DIR/Particles.bb"
compile_and_validate "$SCPCB_DIR/MapSystem.bb"

echo "SCPCB smoke: PASS"
