// Simple static file server for the interpreter
const BASE_DIR = "/Users/jack/Software/blitz3d-wasm/web";

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
};

Deno.serve({ port: 8088 }, async (req) => {
  // Extract just the path from the URL
  const url = new URL(req.url, "http://localhost");
  let path = url.pathname;

  if (path === "/") {
    path = "/interpreter.html";
  }

  const filePath = BASE_DIR + path;
  console.log("Serving:", filePath);

  try {
    const file = await Deno.readFile(filePath);
    const ext = "." + (filePath.split(".").pop() || "");
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch (e) {
    return new Response("Not found: " + path + " (" + e.message + ")", {
      status: 404,
    });
  }
});

console.log("Server running at http://localhost:8088/");
