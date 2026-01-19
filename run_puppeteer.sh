# Rebuild and run test with Puppeteer
set -e
swift build
# Check where compile_test.sh is. Assuming root for now or correcting in next step
./.build/debug/blitz3d-wasm Tests/IntegrationTests/MeshTest.bb -o Tests/IntegrationTests/MeshTest.wasm

# Ensure runtime is bundled
npx -y browserify Sources/Runtime/runtime.js -o dist/runtime.bundle.js

# Start server in background on port 8080
python3 -m http.server 8080 &
SERVER_PID=$!

# Wait for server
sleep 2

# Run puppeteer
PORT=8080 node Tests/IntegrationTests/puppeteer-harness.js
EXIT_CODE=$?

# Kill server
kill $SERVER_PID

exit $EXIT_CODE
