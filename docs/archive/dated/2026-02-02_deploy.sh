#!/bin/bash

# Blitz3D WASM Deployment Script (ARCHIVED)
#
# Archived on 2026-02-02: this script relied on sudo + mutable /var/www/html and
# ad-hoc npm/npx usage. Prefer `deno task web:build` and serve `dist/` instead.
#
# Kept here for reference only.

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WEB_ROOT="/var/www/html"
NPCS_DIR="$SCRIPT_DIR/../../scpcb/GFX/npcs"

echo "=== Blitz3D WASM Deployment ==="
echo ""

# Step 1: Build TypeScript sources
echo "[1/5] Building TypeScript sources..."
if [ -d "web/src" ]; then
    cd web
    if [ -f "package.json" ]; then
        echo "  Running npm build..."
        npm run build 2>&1 | tail -5
    else
        echo "  Compiling TypeScript manually..."
        npx tsc --outDir dist || echo "  Warning: tsc failed, continuing..."
    fi
    cd ..
fi
echo "  ✓ Build complete"
echo ""

# Step 2: Create web root if needed
echo "[2/5] Setting up web root: $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo chown -R $USER:$USER "$WEB_ROOT"
echo "  ✓ Web root ready"
echo ""

# Step 3: Copy HTML and static files
echo "[3/5] Copying static files..."
cp -v web/public/*.html "$WEB_ROOT/" 2>/dev/null || echo "  No HTML files found"
cp -rv web/public/assets "$WEB_ROOT/" 2>/dev/null || echo "  No assets directory"
cp -rv web/public/Data "$WEB_ROOT/" 2>/dev/null || echo "  No Data directory"
cp -rv web/public/GFX "$WEB_ROOT/" 2>/dev/null || echo "  No GFX directory"
cp -rv web/public/SFX "$WEB_ROOT/" 2>/dev/null || echo "  No SFX directory"
echo "  ✓ Static files copied"
echo ""

# Step 4: Copy built JavaScript/TypeScript dist
echo "[4/5] Copying built JavaScript..."
if [ -d "web/dist" ]; then
    mkdir -p "$WEB_ROOT/dist"
    cp -rv web/dist/* "$WEB_ROOT/dist/"
    echo "  ✓ JavaScript copied"
else
    echo "  ⚠ No dist directory found"
fi
if [ -d "web/src" ]; then
    mkdir -p "$WEB_ROOT/src"
    cp -rv web/src/* "$WEB_ROOT/src/"
    echo "  ✓ Source files copied (for browser TS compilation)"
fi
echo ""

# Step 5: Convert and copy new NPC models if source directory exists
echo "[5/5] Converting NPC models (if needed)..."
if [ -d "$NPCS_DIR" ]; then
    echo "  Found SCPCB NPCs at: $NPCS_DIR"
    mkdir -p "$WEB_ROOT/GFX/npcs"
    
    # Check if converter exists
    if [ -f "Tools/convert_b3d_to_smpk.ts" ]; then
        echo "  Checking for models to convert..."
        converted=0
        for b3d_file in "$NPCS_DIR"/*.b3d; do
            if [ -f "$b3d_file" ]; then
                basename=$(basename "$b3d_file" .b3d)
                smpk_file="web/public/GFX/npcs/${basename}.smpk"
                
                # Convert if SMPK doesn't exist or is older than B3D
                if [ ! -f "$smpk_file" ] || [ "$b3d_file" -nt "$smpk_file" ]; then
                    echo "    Converting: ${basename}.b3d -> ${basename}.smpk"
                    npx tsx Tools/convert_b3d_to_smpk.ts "$b3d_file" "$smpk_file" || echo "    ⚠ Conversion failed"
                    converted=$((converted + 1))
                fi
            fi
        done
        
        if [ $converted -eq 0 ]; then
            echo "  All models up to date"
        else
            echo "  ✓ Converted $converted model(s)"
        fi
    fi
    
    # Copy all SMPK files
    echo "  Copying SMPK models to web root..."
    cp -v web/public/GFX/npcs/*.smpk "$WEB_ROOT/GFX/npcs/" 2>/dev/null || echo "  No SMPK files found"
    echo "  ✓ NPC models deployed"
else
    echo "  ⚠ SCPCB source directory not found: $NPCS_DIR"
    echo "  Using existing SMPK files only"
fi
echo ""

echo "=== Deployment Complete ==="
echo ""
echo "Web root: $WEB_ROOT"
echo "NPC Demo: https://blitz3d.exe.xyz:8000/npc_smpk_demo.html"
echo "BB WASM Runner Demo: https://blitz3d.exe.xyz:8000/bb_wasm_runner_demo.html"
echo ""
echo "To start nginx server:"
echo "  cd $WEB_ROOT && busybox httpd -f -p 8000 -h ."
echo ""

