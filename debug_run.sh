set -e
swift build
./.build/debug/blitz3d-wasm Tests/IntegrationTests/MeshTest.bb -o Tests/IntegrationTests/MeshTest.wasm
npx -y browserify Sources/Runtime/runtime.js -o dist/runtime.bundle.js
python3 -m http.server 8081 &
SERVER_PID=$!
sleep 2
export PORT=8081
node Tests/IntegrationTests/puppeteer-harness.js
EXIT_CODE=$?
kill $SERVER_PID
exit $EXIT_CODE
