#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ir_debug_compact.sh <input.bb> [output.wasm]"
  echo ""
  echo "Compiles with --use-ir, then emits compact wasm-validate + analyzer summaries."
  echo "Env overrides:"
  echo "  B3D_DIGEST_MAX (default: 5)"
  echo "  B3D_DIGEST_CONTEXT (default: 1)"
  echo "  B3D_DIGEST_MAX_MAP_MB (default: 64)"
  echo "  B3D_DIGEST_MAX_OBJDUMP_MB (default: 64)"
  echo "  B3D_LLM_FORMAT (default: text)"
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$OUTPUT" ]]; then
  base="$(basename "$INPUT")"
  stem="${base%.*}"
  OUTPUT="/tmp/${stem}.wasm"
fi

COMPILER_BIN="$ROOT/.build/arm64-apple-macosx/debug/blitz3d-wasm"
COMPILER_CMD=()
if [[ -x "$COMPILER_BIN" ]]; then
  COMPILER_CMD=("$COMPILER_BIN")
else
  COMPILER_CMD=(swift run --package-path "$ROOT" blitz3d-wasm)
fi

echo "compiling: $INPUT -> $OUTPUT"
"${COMPILER_CMD[@]}" "$INPUT" --use-ir -g -d -o "$OUTPUT"

MAX_ITEMS="${B3D_DIGEST_MAX:-5}"
CONTEXT_LINES="${B3D_DIGEST_CONTEXT:-1}"
LLM_FORMAT="${B3D_LLM_FORMAT:-text}"

echo ""
echo "wasm-validate digest:"
python3 "$ROOT/Tools/wasm_error_digest.py" "$OUTPUT" \
  --max "$MAX_ITEMS" \
  --context "$CONTEXT_LINES" \
  --map "${OUTPUT}.map" \
  --bbdbg "${OUTPUT%.wasm}.bbdbg.json"

if command -v node >/dev/null 2>&1; then
  echo ""
  echo "NOTE: Tools/analyzer is Node.js-based; skipping (Deno-only workflow)."
fi
