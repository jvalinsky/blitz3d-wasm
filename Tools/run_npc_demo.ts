#!/usr/bin/env -S deno run -A

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(TOOLS_DIR, "..");
const WEB_ROOT = join(PROJECT_ROOT, "web", "public");
const NPCS_DIR = join(WEB_ROOT, "GFX", "npcs");

// List of models and their source filenames if different
const MODELS: Record<string, string> = {
  "173_2": "173_2.b3d",
  "035": "035.b3d",
  "049": "scp-049.b3d",
  "106_2": "106_2.b3d",
  "939": "scp-939.b3d",
  "966": "scp-966.b3d",
  "372": "372.b3d",
  "guard": "guard.b3d",
  "classd": "classd.b3d",
};

async function convertModels() {
  console.log("=== Converting NPC Models ===");

  for (const [name, source] of Object.entries(MODELS)) {
    const b3dPath = join(NPCS_DIR, source);
    const smpkPath = join(NPCS_DIR, `${name}.smpk`);

    console.log(`Converting ${source} -> ${name}.smpk...`);

    // Check if source exists
    try {
      await Deno.stat(b3dPath);
    } catch {
      console.error(`❌ Source not found: ${b3dPath}`);
      continue;
    }

    const cmd = new Deno.Command("deno", {
      args: [
        "run",
        "-A",
        join(TOOLS_DIR, "convert_b3d_to_smpk.ts"),
        b3dPath,
        smpkPath,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const output = await cmd.output();
    if (output.success) {
      console.log(`✅ Converted ${name}.smpk`);
    } else {
      console.error(`❌ Failed to convert ${name}`);
      const err = new TextDecoder().decode(output.stderr);
      console.error(err);
    }
  }
  console.log("=== Conversion Complete ===\n");
}

async function getAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port < 65535) {
    try {
      const listener = Deno.listen({ port });
      listener.close();
      return port;
    } catch (e) {
      if (e instanceof Deno.errors.AddrInUse) {
        port++;
      } else {
        throw e;
      }
    }
  }
  throw new Error("No free ports available");
}

async function serveDemo() {
  console.log("=== Starting Demo Server ===");

  const port = await getAvailablePort(8000);

  console.log(`Root: ${WEB_ROOT}`);
  console.log(`URL:  http://localhost:${port}/npc_smpk_demo.html`);
  console.log("(Ctrl+C to stop)");

  // Use the existing serve_dir.ts tool
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      join(TOOLS_DIR, "serve_dir.ts"),
      "--root",
      WEB_ROOT,
      "--port",
      port.toString(),
    ],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const child = cmd.spawn();

  // Handle graceful shutdown
  Deno.addSignalListener("SIGINT", () => {
    console.log("\nStopping server...");
    child.kill();
    Deno.exit(0);
  });

  await child.status;
}

if (import.meta.main) {
  await convertModels();
  await serveDemo();
}
