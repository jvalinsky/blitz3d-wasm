import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const port = 8001;

Deno.serve({ port }, (req) => {
  return serveDir(req, {
    fsRoot: ".",
    enableCors: true,
  });
});

console.log(`Server running on http://localhost:${port}/`);
