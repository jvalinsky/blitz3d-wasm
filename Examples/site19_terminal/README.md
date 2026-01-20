# Site-19 Terminal Demo Instructions

To run this demo, you need a local web server because browsers block loading WASM and other files from the file system (`file://`) for security reasons.

## Running with Python
If you have Python installed:

1. Open terminal in this directory:
   ```bash
   cd examples/site19_terminal
   ```

2. Start server:
   ```bash
   python3 -m http.server 8000
   ```

3. Open browser:
   http://localhost:8000

## Running with Node.js
If you have Node.js installed:

1. Install `http-server` globally (once):
   ```bash
   npm install -g http-server
   ```

2. Start server:
   ```bash
   http-server .
   ```

## Controls
- **Rotate**: Mesh auto-rotates.
- **Select File**: Click on files in the "ASSET_DATABASE" list.
- **Upload**: Upload your own `.rmesh` file.
