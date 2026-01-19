#!/usr/bin/env node

/**
 * Simple HTTP Server for SCPCB Asset Viewer Demo
 * Serves static files from the examples directory
 * Maps /scpcb/* to /Users/jack/Software/scp_port/scpcb/*
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const RUNTIME_DIR = __dirname;  // /Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime
const EXAMPLES_DIR = path.join(RUNTIME_DIR, 'examples');  // /Users/jack/Software/scp_port/blitz3d-wasm/Sources/Runtime/examples
const SCPCB_DIR = '/Users/jack/Software/scp_port/scpcb';  // Hardcoded path to scpcb

console.log(`Server config:`);
console.log(`  RUNTIME_DIR: ${RUNTIME_DIR}`);
console.log(`  EXAMPLES_DIR: ${EXAMPLES_DIR}`);
console.log(`  SCPCB_DIR: ${SCPCB_DIR}`);

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.map': 'application/json',
    '.rmesh': 'application/octet-stream',
    '.b3d': 'application/octet-stream'
};

const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    
    console.log(`Request: ${urlPath}`);
    
    // Map /scpcb/* to /Users/jack/Software/scp_port/scpcb/*
    let filePath;
    if (urlPath === '/' || urlPath === '/scpcb_asset_viewer.html') {
        // Serve the main HTML file
        filePath = path.join(EXAMPLES_DIR, 'scpcb_asset_viewer.html');
    } else if (urlPath.startsWith('/scpcb/')) {
        // Map /scpcb/... to /Users/jack/Software/scp_port/scpcb/...
        const relativePath = urlPath.substring('/scpcb/'.length);
        filePath = path.join(SCPCB_DIR, relativePath);
    } else {
        // Serve from examples directory
        filePath = path.join(EXAMPLES_DIR, urlPath.substring(1));
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.log(`  Not found: ${filePath}`);
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found: ' + urlPath);
            } else {
                res.writeHead(500);
                res.end('Server error: ' + err.message);
            }
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║   SCPCB Asset Viewer Demo Server              ║`);
    console.log(`╠════════════════════════════════════════════════╣`);
    console.log(`║   Server running at:                          ║`);
    console.log(`║   http://localhost:${PORT}                       ║`);
    console.log(`╠════════════════════════════════════════════════╣`);
    console.log(`║   Demo: http://localhost:${PORT}/                  ║`);
    console.log(`║   Assets: /scpcb/* → ${SCPCB_DIR}  ║`);
    console.log(`╚════════════════════════════════════════════════╝\n`);
});
