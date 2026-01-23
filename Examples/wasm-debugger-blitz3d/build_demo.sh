#!/usr/bin/env bash
set -euo pipefail

# Regenerate the debugger demo artifacts from a given .bb source.
# Usage: ./build_demo.sh path/to/program.bb
# Outputs (overwrites):
#   data/sample.bb             (copied source)
#   data/sample.wasm           (compiled WASM)
#   data/sample.wat            (disassembly if wasm2wat available)
#   data/sample.bbdbg.json     (line-based stub mapping)
#   data/sample.trace.json     (sequential stub trace)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$SCRIPT_DIR/data"

SRC_BB=${1:-}
if [[ -z "$SRC_BB" ]]; then
  echo "Usage: $0 path/to/program.bb" >&2
  exit 1
fi

if [[ ! -f "$SRC_BB" ]]; then
  echo "BB source not found: $SRC_BB" >&2
  exit 1
fi

mkdir -p "$DATA_DIR"

OUT_BB="$DATA_DIR/sample.bb"
OUT_WASM="$DATA_DIR/sample.wasm"
OUT_WAT="$DATA_DIR/sample.wat"
OUT_MAP="$DATA_DIR/sample.bbdbg.json"
OUT_TRACE="$DATA_DIR/sample.trace.json"

# 1) Compile to WASM using the blitz3d-wasm compiler
pushd "$ROOT_DIR" >/dev/null
swift run blitz3d-wasm "$SRC_BB" -o "$OUT_WASM"
popd >/dev/null

# 2) Validate if available
if command -v wasm-validate >/dev/null 2>&1; then
  wasm-validate "$OUT_WASM" && echo "WASM validated"
fi

# 3) Optional WAT disassembly
if command -v wasm2wat >/dev/null 2>&1; then
  wasm2wat "$OUT_WASM" -o "$OUT_WAT"
else
  echo "wasm2wat not found; skipping WAT disassembly" >&2
  : > "$OUT_WAT"
fi

# 4) Copy source
cp "$SRC_BB" "$OUT_BB"

# 5) Generate a stub mapping (line-based) and stub trace for the UI.
#    This is NOT source-accurate; replace with real bbdbg output when compiler emits it.
#    The viewer will prefer live bbdbg events if CONFIG.wasmUrl is set.
python3 - "$SRC_BB" "$OUT_MAP" "$OUT_TRACE" <<'PYCODE'
import json, sys
src_path, map_out, trace_out = sys.argv[1:4]
with open(src_path, 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# Build spans and stmt table: one stmt per non-empty line
spans = []
stmts = []
stmt_sites = []
span_id = 1
stmt_id = 1
for idx, line in enumerate(lines, start=1):
    if not line.strip():
        continue
    spans.append({
        "spanId": span_id,
        "sourceId": 1,
        "startLine": idx,
        "startCol": 1,
        "endLine": idx,
        "endCol": len(line)
    })
    stmts.append({"stmtId": stmt_id, "spanId": span_id, "kind": "line"})
    stmt_sites.append({"stmtId": stmt_id, "funcId": 0, "siteIndex": stmt_id - 1})
    span_id += 1
    stmt_id += 1

mapping = {
    "sources": [{"sourceId": 1, "path": src_path}],
    "spans": spans,
    "stmts": stmts,
    "wasm": {
        "functions": [{"funcId": 0, "exportName": "main", "wasmFuncIndex": 0, "watName": "$main"}],
        "stmtSites": stmt_sites,
    },
    "symbols": {
        "funcs": [{"funcId": 0, "name": "Main", "params": [], "locals": []}],
        "globals": []
    }
}
with open(map_out, 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2)

trace = [{"op": "enter", "frameId": 0, "funcId": 0}]
for s in stmts:
    trace.append({"op": "stmt", "stmtId": s["stmtId"], "siteIndex": s["stmtId"] - 1})
trace.append({"op": "leave", "frameId": 0})
with open(trace_out, 'w', encoding='utf-8') as f:
    json.dump(trace, f, indent=2)
PYCODE

echo "Demo artifacts written to $DATA_DIR"
