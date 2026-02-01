import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { extname } from "https://deno.land/std@0.224.0/path/extname.ts";

const port = 8001;

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Block TypeScript source files
  if (path.endsWith(".ts") && !path.includes("/node_modules/")) {
    return new Response("TypeScript files cannot be loaded in browser", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Use serveDir for directory listing and file serving
  const response = await serveDir(req, {
    fsRoot: ".",
    enableCors: true,
  });

  // Add explicit MIME type headers for known file types
  const fileExt = extname(path);
  if (mimeTypes[fileExt]) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", mimeTypes[fileExt]);
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  }

  return response;
});

console.log(`Server running on http://localhost:${port}/`);
console.log(`Open http://localhost:${port}/demo-live.html for the live compiler demo`);
