#!/usr/bin/env -S deno run --allow-net --allow-read

const PORT = 8000;
const BASE_DIR = new URL(".", import.meta.url).pathname;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".rmesh": "application/octet-stream",
  ".bmp": "image/bmp",
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let path = decodeURIComponent(url.pathname);

  // Default to index.html
  if (path === "/") {
    path = "/index.html";
  }

  const filePath = BASE_DIR + path.slice(1);

  try {
    const file = await Deno.readFile(filePath);
    const mimeType = getMimeType(path);

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log(`Server running at http://localhost:${PORT}/`);
Deno.serve({ port: PORT }, handleRequest);
