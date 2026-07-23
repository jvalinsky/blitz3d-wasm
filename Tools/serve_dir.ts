#!/usr/bin/env -S deno run -A
import { extname, join, normalize, resolve } from "node:path";

type Args = {
  root: string;
  port: number;
  host: string;
};

const parseArgs = (): Args => {
  const rootIdx = Deno.args.findIndex((a) => a === "--root");
  const portIdx = Deno.args.findIndex((a) => a === "--port");
  const hostIdx = Deno.args.findIndex((a) => a === "--host");
  const root = rootIdx >= 0 ? (Deno.args[rootIdx + 1] ?? ".") : ".";
  const port = portIdx >= 0 ? Number(Deno.args[portIdx + 1] ?? "8000") : 8000;
  const host = hostIdx >= 0 ? (Deno.args[hostIdx + 1] ?? "0.0.0.0") : "0.0.0.0";
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`bad --port: ${port}`);
  }
  return { root, port, host };
};

const mimeFor = (path: string): string => {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".ts":
      return "text/javascript; charset=utf-8"; // Serve TypeScript as JavaScript for browser imports
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
};

const safeJoin = (rootAbs: string, urlPath: string): string | null => {
  const p = urlPath.split("?")[0]!.split("#")[0]!;
  const decoded = (() => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  })();
  const stripped = decoded.replace(/^\/+/, "");
  const full = resolve(join(rootAbs, normalize(stripped)));
  if (!full.startsWith(rootAbs)) return null;
  return full;
};

if (import.meta.main) {
  const args = parseArgs();
  const rootAbs = resolve(args.root);
  console.log(`[serve] root=${rootAbs}`);
  console.log(`[serve] http://${args.host}:${args.port}/`);

  Deno.serve({ hostname: args.host, port: args.port }, async (req) => {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = safeJoin(rootAbs, path);
    if (!full) return new Response("Bad path", { status: 400 });

    try {
      const st = await Deno.stat(full);
      if (st.isDirectory) {
        const idx = join(full, "index.html");
        const bytes = await Deno.readFile(idx);
        return new Response(bytes, {
          headers: { "content-type": mimeFor(idx) },
        });
      }
      const bytes = await Deno.readFile(full);
      return new Response(bytes, {
        headers: { "content-type": mimeFor(full) },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
