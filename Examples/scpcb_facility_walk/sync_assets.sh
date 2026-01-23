#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAP_NAME=${1:-testroom_opt.rmesh}
SRC_MAP="$SCRIPT_DIR/../../..//scpcb/GFX/map/$MAP_NAME"
ASSET_DIR="$SCRIPT_DIR/assets"

if [ ! -f "$SRC_MAP" ]; then
  echo "Map not found: $SRC_MAP" >&2
  exit 1
fi

mkdir -p "$ASSET_DIR"
cp "$SRC_MAP" "$ASSET_DIR/"

echo "Scanning textures in $MAP_NAME..."
MAP_PATH="$SRC_MAP" ASSET_DIR="$ASSET_DIR" SCP_ROOT="$SCRIPT_DIR/../../..//scpcb" python3 - <<'PY'
import re
from pathlib import Path
import shutil
import os
import sys

map_path = Path(os.environ["MAP_PATH"])
asset_dir = Path(os.environ["ASSET_DIR"])
root = Path(os.environ["SCP_ROOT"])

blob = map_path.read_bytes()
strings = []
cur = bytearray()
for b in blob:
    if 32 <= b < 127:
        cur.append(b)
    else:
        if len(cur) >= 4:
            strings.append(cur.decode('ascii', 'ignore'))
        cur = bytearray()
if len(cur) >= 4:
    strings.append(cur.decode('ascii', 'ignore'))

textures = sorted({s for s in strings if re.search(r'\.(bmp|png|jpg|jpeg)$', s, re.I)})
missing = []

search_roots = [root / 'GFX', root / 'GFX' / 'map']

for tex in textures:
    name = Path(tex).name
    target = asset_dir / name
    if target.exists() and target.stat().st_size > 0:
        continue
    found = None
    for sr in search_roots:
        for p in sr.rglob(name):
            if p.is_file() and p.stat().st_size > 0:
                found = p
                break
        if found:
            break
    if not found:
        missing.append(name)
        continue
    shutil.copy(found, target)
    print(f"Copied {name} <- {found}")

if missing:
    print("Missing textures:")
    for m in missing:
        print(" -", m)
    sys.exit(2)

print("Assets synced successfully.")
PY
