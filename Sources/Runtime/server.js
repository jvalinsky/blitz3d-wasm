#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { dirname, extname, fromFileUrl, join, normalize } from "jsr:@std/path";

/**
 * Simple HTTP Server for SCPCB Asset Viewer Demo
 * Serves static files from the examples directory
 * Maps /scpcb/* to /Users/jack/Software/scp_port/scpcb/*
 */

const PORT = Deno.env.get("PORT") || 3000;
const RUNTIME_DIR = dirname(fromFileUrl(import.meta.url));
const EXAMPLES_DIR = join(RUNTIME_DIR, "examples");
const SCPCB_DIR = "/Users/jack/Software/scp_port/scpcb";

console.log("Server config:");
console.log(`  RUNTIME_DIR: ${RUNTIME_DIR}`);
console.log(`  EXAMPLES_DIR: ${EXAMPLES_DIR}`);
console.log(`  SCPCB_DIR: ${SCPCB_DIR}`);

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".rmesh": "application/octet-stream",
  ".b3d": "application/octet-stream",
};

Deno.serve({ port: Number(PORT) }, async (req) => {
  const url = new URL(req.url);
  const urlPath = url.pathname.split("?")[0];

  console.log(`Request: ${urlPath}`);

  let filePath;
  if (urlPath === "/" || urlPath === "/scpcb_asset_viewer.html") {
    filePath = join(EXAMPLES_DIR, "scpcb_asset_viewer.html");
  } else if (urlPath.startsWith("/scpcb/")) {
    const relativePath = urlPath.substring("/scpcb/".length);
    filePath = join(SCPCB_DIR, relativePath);
  } else {
    filePath = join(EXAMPLES_DIR, urlPath.substring(1));
  }

  const normalizedPath = normalize(filePath);
  const ext = extname(normalizedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  if (!normalizedPath.startsWith(EXAMPLES_DIR) && !normalizedPath.startsWith(SCPCB_DIR)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await Deno.readFile(normalizedPath);
    return new Response(data, { status: 200, headers: { "Content-Type": contentType } });
  } catch (err) {
    console.log(`  Not found: ${normalizedPath}`);
    if (err instanceof Deno.errors.NotFound) {
      return new Response(`File not found: ${urlPath}`, { status: 404 });
    }

    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
});

console.log(`\n╔════════════════════════════════════════════════╗`);
console.log(`║   SCPCB Asset Viewer Demo Server              ║`);
console.log(`╠════════════════════════════════════════════════╣`);
console.log(`║   Server running at:                          ║`);
console.log(`║   http://localhost:${PORT}                       ║`);
console.log(`╠════════════════════════════════════════════════╣`);
console.log(`║   Demo: http://localhost:${PORT}/                  ║`);
console.log(`║   Assets: /scpcb/* → ${SCPCB_DIR}  ║`);
console.log(`╚════════════════════════════════════════════════╝\n`);
