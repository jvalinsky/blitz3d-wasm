import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const port = Number(Deno.env.get("PORT") ?? 8082);

// Serve from public/ for demos, or dist/ for production
const usePublic = Deno.env.get("SERVE_PUBLIC") === "1";
const root = usePublic
    ? new URL("./public/", import.meta.url).pathname
    : new URL("../dist/", import.meta.url).pathname;

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

const cacheControlFor = (urlPath: string, ext: string): string => {
  // HTML changes frequently and references hashed assets. If it is cached while
  // the server deploys a new build, clients can end up requesting old hashed
  // chunk URLs that no longer exist -> dynamic import 404s.
  if (ext === ".html") return "no-store";

  // Vite hashed assets are safe to cache forever.
  if (urlPath.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }

  // Everything else (wasm, manifest, options.ini, etc): revalidate each load.
  return "no-cache";
};

const handler = async (req: Request) => {
  const url = new URL(req.url);
  let path = url.pathname;
  if (path === "/") {
    // Default to NPC demo
    path = "/npc_smpk_demo.html";
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
      "cache-control": cacheControlFor(path, ext),
    });
    return new Response(file.readable, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

console.log(`Serving ${usePublic ? "public/" : "dist/"} on http://localhost:${port}`);
serve(handler, { port, hostname: "0.0.0.0" });
