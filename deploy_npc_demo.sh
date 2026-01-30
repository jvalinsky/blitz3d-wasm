#!/bin/bash
# Deploy SCPCB NPC demo to blitz3d.exe.xyz

set -e

SERVER="blitz3d.exe.xyz"
LOCAL_DIR="/home/exedev/Software/blitz3d-wasm/web/public"
REMOTE_DIR="/var/www/blitz3d"

echo "=== Deploying SCPCB NPC Demo to $SERVER ==="

# Sync web/public to server (includes HTML demos + GFX/npcs/*.smpk)
echo "Syncing web/public directory..."
rsync -avz --progress \
    --include='*.html' \
    --include='*.smpk' \
    --include='*.js' \
    --include='*.css' \
    --include='*.json' \
    --exclude='*.map' \
    $LOCAL_DIR/ $SERVER:$REMOTE_DIR/

echo ""
echo "=== Deployed! ==="
echo ""
echo "Demos:"
echo "  http://$SERVER:3000/npc_smpk_demo.html"
echo "  http://$SERVER:3000/npc_model_demo.html"
echo ""
echo "Available SMPK models:"
ssh $SERVER "ls $REMOTE_DIR/GFX/npcs/*.smpk 2>/dev/null | head -10 | xargs -I{} basename {}" || echo "  (none found)"
