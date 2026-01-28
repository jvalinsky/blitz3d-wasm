import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const port = Number(Deno.env.get("PORT") ?? 8082);
const root = new URL("../dist/", import.meta.url).pathname;

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const handler = async (req: Request) => {
  const url = new URL(req.url);
  let path = url.pathname;
  if (path === "/") {
    path = "/index.html";
  }

  const filePath = join(root, decodeURIComponent(path));
  try {
    const file = await Deno.open(filePath, { read: true });
    const stat = await file.stat();
    if (stat.isDirectory) {
      file.close();
      return new Response("Not found", { status: 404 });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] ?? "application/octet-stream";
    const headers = new Headers({
      "content-type": contentType,
      "content-length": stat.size.toString(),
    });
    return new Response(file.readable, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

console.log(`Serving dist/ on http://localhost:${port}`);
serve(handler, { port, hostname: "0.0.0.0" });
